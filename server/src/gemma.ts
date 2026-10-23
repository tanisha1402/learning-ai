import type { GemmaConfig } from "./config";
import { AppError } from "./errors";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  maxOutputTokens: number;
  /** Request JSON output (only applied when GEMMA_JSON_MODE is on). */
  json?: boolean;
}

export interface ChatResult {
  content: string;
  outputTokens: number | null;
  finishReason: string | null;
}

export type ProviderState =
  | "ready"
  | "not_configured"
  | "auth_failed"
  | "model_not_found"
  | "rate_limited"
  | "unreachable"
  | "error";

export interface ProviderStatus {
  state: ProviderState;
}

interface ProviderError {
  message: string;
  status: string;
  retryDelay: string | null;
}

interface GenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown; thought?: unknown }> };
    finishReason?: unknown;
  }>;
  usageMetadata?: { candidatesTokenCount?: unknown };
  promptFeedback?: { blockReason?: unknown };
}

const GOOGLE_KEY_PATTERN = /AIza[0-9A-Za-z_-]{20,}/g;
const HEALTH_CACHE_MS = 10_000;

/** Remove anything that looks like an API key from text before logging it. */
export function redactSecrets(text: string, apiKey?: string): string {
  let out = text.replace(GOOGLE_KEY_PATTERN, "[redacted]");
  if (apiKey && apiKey.length >= 8) out = out.split(apiKey).join("[redacted]");
  return out;
}

/**
 * Client for Google's Gemini API (generativelanguage.googleapis.com), used with a hosted Gemma model.
 * Auth: `x-goog-api-key` header (the key never appears in URLs, logs or responses).
 */
export class GemmaClient {
  private statusCache: { at: number; value: ProviderStatus } | null = null;

  constructor(
    private readonly cfg: GemmaConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private get modelUrl(): string {
    return `${this.cfg.baseUrl}/models/${encodeURIComponent(this.cfg.model)}`;
  }

  /** Cheap health probe: GET models/{model} (metadata only, never generates text). Cached for a few seconds. */
  async getStatus(): Promise<ProviderStatus> {
    if (!this.cfg.apiKey) return { state: "not_configured" };
    if (this.statusCache && Date.now() - this.statusCache.at < HEALTH_CACHE_MS) return this.statusCache.value;

    const value = await this.probe();
    this.statusCache = { at: Date.now(), value };
    return value;
  }

  private async probe(): Promise<ProviderStatus> {
    try {
      const res = await this.fetchFn(this.modelUrl, {
        headers: { "x-goog-api-key": this.cfg.apiKey as string },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return { state: "ready" };
      const err = await this.readProviderError(res);
      this.logProviderError("health", res.status, err);
      if (res.status === 404) return { state: "model_not_found" };
      if (res.status === 401 || res.status === 403 || this.looksLikeAuthError(res.status, err)) {
        return { state: "auth_failed" };
      }
      if (res.status === 429) return { state: "rate_limited" };
      return { state: "error" };
    } catch {
      return { state: "unreachable" };
    }
  }

  /** Single non-streaming generateContent call. */
  async chat(opts: ChatOptions): Promise<ChatResult> {
    if (!this.cfg.apiKey) {
      throw new AppError(
        503,
        "AI_NOT_CONFIGURED",
        "The server has no GEMMA_API_KEY configured, so it cannot call the Gemma API. Add the key to the server environment and restart.",
      );
    }

    const apiKey = this.cfg.apiKey;
    let useJson = Boolean(opts.json) && this.cfg.jsonMode;
    let thinkingLevel = this.cfg.thinkingLevel;

    for (let attempt = 0; attempt < 3; attempt++) {
      const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content);
      const generationConfig: Record<string, unknown> = {
        temperature: this.cfg.temperature,
        maxOutputTokens: opts.maxOutputTokens,
      };
      if (useJson) generationConfig.responseMimeType = "application/json";
      if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };

      const body: Record<string, unknown> = {
        contents: opts.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig,
      };
      if (system.length > 0) body.systemInstruction = { parts: [{ text: system.join("\n\n") }] };

      let res: Response;
      try {
        res = await this.fetchFn(`${this.modelUrl}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.cfg.timeoutMs),
        });
      } catch (err) {
        throw this.mapNetworkError(err);
      }

      if (res.ok) return this.readResult(res);

      const err = await this.readProviderError(res);
      if (res.status === 400) {
        const lower = err.message.toLowerCase();
        // The model may not accept an optional parameter: drop it and retry (at most twice).
        if (thinkingLevel && lower.includes("thinking")) {
          thinkingLevel = undefined;
          continue;
        }
        if (useJson && /mime|json|response/.test(lower)) {
          useJson = false;
          continue;
        }
      }
      this.logProviderError("generate", res.status, err);
      throw this.mapHttpError(res.status, err);
    }
    throw new AppError(502, "AI_ERROR", "The Gemma API rejected the request.");
  }

  private async readResult(res: Response): Promise<ChatResult> {
    let data: GenerateContentResponse;
    try {
      data = (await res.json()) as GenerateContentResponse;
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw this.mapNetworkError(err);
      }
      throw new AppError(502, "AI_ERROR", "The Gemma API returned a response that could not be read.");
    }

    const blockReason = data.promptFeedback?.blockReason;
    if (typeof blockReason === "string" && !data.candidates?.length) {
      throw new AppError(
        502,
        "MODEL_EMPTY_RESPONSE",
        `The request was blocked by the provider's safety filters (${blockReason}). Try different text.`,
      );
    }

    const candidate = data.candidates?.[0];
    // Skip "thought" parts: only the final answer text is returned to callers.
    const content = (candidate?.content?.parts ?? [])
      .filter((p) => p.thought !== true && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
    const tokens = data.usageMetadata?.candidatesTokenCount;

    return {
      content,
      outputTokens: typeof tokens === "number" ? tokens : null,
      finishReason: typeof candidate?.finishReason === "string" ? candidate.finishReason : null,
    };
  }

  private async readProviderError(res: Response): Promise<ProviderError> {
    let raw = "";
    try {
      raw = await res.text();
    } catch {
      // ignore
    }
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: unknown; status?: unknown; details?: Array<{ retryDelay?: unknown }> };
      };
      const retry = parsed.error?.details?.find((d) => typeof d?.retryDelay === "string")?.retryDelay;
      return {
        message: typeof parsed.error?.message === "string" ? parsed.error.message : raw,
        status: typeof parsed.error?.status === "string" ? parsed.error.status : "",
        retryDelay: typeof retry === "string" ? retry : null,
      };
    } catch {
      return { message: raw, status: "", retryDelay: null };
    }
  }

  private looksLikeAuthError(status: number, err: ProviderError): boolean {
    return status === 400 && /api key|api_key/i.test(err.message);
  }

  private logProviderError(kind: string, status: number, err: ProviderError): void {
    // Only status codes and the provider's own short error text: never request bodies or keys.
    const msg = redactSecrets(err.message.replace(/\s+/g, " ").trim(), this.cfg.apiKey).slice(0, 200);
    console.warn(`[gemma:${kind}] HTTP ${status} ${err.status} ${msg}`);
  }

  private mapNetworkError(err: unknown): AppError {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return new AppError(
        504,
        "AI_TIMEOUT",
        "The Gemma API took too long to respond. Try shorter text, or raise GEMMA_TIMEOUT_MS.",
      );
    }
    return new AppError(503, "AI_UNREACHABLE", "Cannot reach the Gemma API. Check the server's internet connection and GEMMA_BASE_URL.");
  }

  private mapHttpError(status: number, err: ProviderError): AppError {
    if (status === 401 || status === 403 || this.looksLikeAuthError(status, err)) {
      return new AppError(
        502,
        "AI_AUTH_ERROR",
        "The Gemma API rejected the server's API key. The site owner needs to check GEMMA_API_KEY.",
      );
    }
    if (status === 404) {
      return new AppError(
        503,
        "MODEL_NOT_FOUND",
        `Model "${this.cfg.model}" was not found. Check GEMMA_MODEL (for example gemma-4-26b-a4b-it or gemma-4-31b-it).`,
      );
    }
    if (status === 429) {
      const wait = err.retryDelay ? ` Try again in about ${err.retryDelay}.` : " Wait a minute and try again.";
      return new AppError(429, "AI_RATE_LIMITED", `The free Gemma API quota or rate limit was reached.${wait}`);
    }
    if (status >= 500) {
      return new AppError(502, "AI_ERROR", `The Gemma API is temporarily unavailable (HTTP ${status}). Please try again shortly.`);
    }
    const short = redactSecrets(err.message.replace(/\s+/g, " ").trim(), this.cfg.apiKey).slice(0, 200);
    return new AppError(502, "AI_ERROR", `The Gemma API returned an error (HTTP ${status})${short ? `: ${short}` : "."}`);
  }
}
