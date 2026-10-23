import { describe, expect, it } from "vitest";
import type { GemmaConfig } from "../src/config";
import { GemmaClient, redactSecrets } from "../src/gemma";

const KEY = "AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKE12345";

const cfg: GemmaConfig = {
  apiKey: KEY,
  baseUrl: "https://gemini.test/v1beta",
  model: "gemma-4-26b-a4b-it",
  timeoutMs: 5000,
  temperature: 0.3,
  maxOutputTokensSummary: 800,
  maxOutputTokensQuiz: 1800,
  thinkingLevel: "minimal",
  jsonMode: false,
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, any> | null;
}

function fakeFetch(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const fn = (async (url: unknown, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    const next = responses.shift();
    if (!next) throw new Error("No more fake responses");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const request = {
  messages: [
    { role: "system" as const, content: "Be brief." },
    { role: "user" as const, content: "hi" },
  ],
  maxOutputTokens: 100,
};

const okBody = (text: string, extra: Record<string, unknown> = {}) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  usageMetadata: { candidatesTokenCount: 7 },
  ...extra,
});

describe("redactSecrets", () => {
  it("removes Google-style keys and the configured key", () => {
    expect(redactSecrets(`bad key ${KEY} here`)).toBe("bad key [redacted] here");
    expect(redactSecrets("token=abcdefgh12345", "abcdefgh12345")).toBe("token=[redacted]");
  });
});

describe("GemmaClient.getStatus", () => {
  it("reports not_configured without calling the network", async () => {
    const { fn, calls } = fakeFetch([]);
    const status = await new GemmaClient({ ...cfg, apiKey: undefined }, fn).getStatus();
    expect(status.state).toBe("not_configured");
    expect(calls).toHaveLength(0);
  });

  it("reports ready via GET models/{model} with the key in a header, not the URL", async () => {
    const { fn, calls } = fakeFetch([jsonResponse(200, { name: "models/gemma-4-26b-a4b-it" })]);
    const status = await new GemmaClient(cfg, fn).getStatus();
    expect(status.state).toBe("ready");
    expect(calls[0].url).toBe("https://gemini.test/v1beta/models/gemma-4-26b-a4b-it");
    expect(calls[0].url).not.toContain(KEY);
    expect(calls[0].headers["x-goog-api-key"]).toBe(KEY);
  });

  it.each([
    [404, { error: { message: "not found", status: "NOT_FOUND" } }, "model_not_found"],
    [403, { error: { message: "denied", status: "PERMISSION_DENIED" } }, "auth_failed"],
    [400, { error: { message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }, "auth_failed"],
    [429, { error: { message: "quota", status: "RESOURCE_EXHAUSTED" } }, "rate_limited"],
    [500, { error: { message: "boom", status: "INTERNAL" } }, "error"],
  ])("maps HTTP %i to %s", async (status, body, expected) => {
    const { fn } = fakeFetch([jsonResponse(status, body)]);
    expect((await new GemmaClient(cfg, fn).getStatus()).state).toBe(expected);
  });

  it("reports unreachable when fetch fails", async () => {
    const { fn } = fakeFetch([new TypeError("fetch failed")]);
    expect((await new GemmaClient(cfg, fn).getStatus()).state).toBe("unreachable");
  });

  it("caches the result briefly", async () => {
    const { fn, calls } = fakeFetch([jsonResponse(200, {})]);
    const client = new GemmaClient(cfg, fn);
    await client.getStatus();
    await client.getStatus();
    expect(calls).toHaveLength(1);
  });
});

describe("GemmaClient.chat", () => {
  it("builds a generateContent request (system instruction, roles, generationConfig)", async () => {
    const { fn, calls } = fakeFetch([jsonResponse(200, okBody("hello"))]);
    const result = await new GemmaClient(cfg, fn).chat(request);
    expect(result).toEqual({ content: "hello", outputTokens: 7, finishReason: "STOP" });

    const call = calls[0];
    expect(call.method).toBe("POST");
    expect(call.url).toBe("https://gemini.test/v1beta/models/gemma-4-26b-a4b-it:generateContent");
    expect(call.url).not.toContain(KEY);
    expect(call.headers["x-goog-api-key"]).toBe(KEY);
    expect(call.body).toMatchObject({
      systemInstruction: { parts: [{ text: "Be brief." }] },
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 100, thinkingConfig: { thinkingLevel: "minimal" } },
    });
    expect(call.body?.generationConfig).not.toHaveProperty("responseMimeType");
  });

  it("only sends responseMimeType when GEMMA_JSON_MODE is on and json is requested", async () => {
    const { fn, calls } = fakeFetch([jsonResponse(200, okBody("{}")), jsonResponse(200, okBody("{}"))]);
    const client = new GemmaClient({ ...cfg, jsonMode: true }, fn);
    await client.chat({ ...request, json: true });
    await client.chat(request);
    expect(calls[0].body?.generationConfig.responseMimeType).toBe("application/json");
    expect(calls[1].body?.generationConfig).not.toHaveProperty("responseMimeType");
  });

  it("omits thinkingConfig when thinkingLevel is unset", async () => {
    const { fn, calls } = fakeFetch([jsonResponse(200, okBody("x"))]);
    await new GemmaClient({ ...cfg, thinkingLevel: undefined }, fn).chat(request);
    expect(calls[0].body?.generationConfig).not.toHaveProperty("thinkingConfig");
  });

  it("ignores thought parts and joins answer parts", async () => {
    const body = {
      candidates: [{ content: { parts: [{ text: "secret reasoning", thought: true }, { text: "Answer " }, { text: "text." }] } }],
    };
    const { fn } = fakeFetch([jsonResponse(200, body)]);
    const result = await new GemmaClient(cfg, fn).chat(request);
    expect(result.content).toBe("Answer text.");
    expect(result.outputTokens).toBeNull();
  });

  it("throws AI_NOT_CONFIGURED without a key and makes no request", async () => {
    const { fn, calls } = fakeFetch([]);
    await expect(new GemmaClient({ ...cfg, apiKey: undefined }, fn).chat(request)).rejects.toMatchObject({
      status: 503,
      code: "AI_NOT_CONFIGURED",
    });
    expect(calls).toHaveLength(0);
  });

  it("reports provider safety blocks as MODEL_EMPTY_RESPONSE", async () => {
    const { fn } = fakeFetch([jsonResponse(200, { promptFeedback: { blockReason: "SAFETY" } })]);
    await expect(new GemmaClient(cfg, fn).chat(request)).rejects.toMatchObject({ code: "MODEL_EMPTY_RESPONSE" });
  });

  it("maps connection failures to AI_UNREACHABLE (503)", async () => {
    const { fn } = fakeFetch([new TypeError("fetch failed")]);
    await expect(new GemmaClient(cfg, fn).chat(request)).rejects.toMatchObject({ status: 503, code: "AI_UNREACHABLE" });
  });

  it("maps timeouts to AI_TIMEOUT (504)", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const { fn } = fakeFetch([timeout]);
    await expect(new GemmaClient(cfg, fn).chat(request)).rejects.toMatchObject({ status: 504, code: "AI_TIMEOUT" });
  });

  it("maps rejected keys to AI_AUTH_ERROR without echoing provider text", async () => {
    const { fn } = fakeFetch([
      jsonResponse(400, { error: { message: `API key not valid. ${KEY}`, status: "INVALID_ARGUMENT" } }),
    ]);
    const err = await new GemmaClient(cfg, fn).chat(request).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 502, code: "AI_AUTH_ERROR" });
    expect(String((err as Error).message)).not.toContain(KEY);
  });

  it("maps 429 to AI_RATE_LIMITED and includes a retry hint when given", async () => {
    const { fn } = fakeFetch([
      jsonResponse(429, {
        error: { message: "quota", status: "RESOURCE_EXHAUSTED", details: [{ retryDelay: "30s" }] },
      }),
    ]);
    const err = await new GemmaClient(cfg, fn).chat(request).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 429, code: "AI_RATE_LIMITED" });
    expect((err as Error).message).toContain("30s");
  });

  it("maps 404 to MODEL_NOT_FOUND", async () => {
    const { fn } = fakeFetch([jsonResponse(404, { error: { message: "model not found", status: "NOT_FOUND" } })]);
    await expect(new GemmaClient(cfg, fn).chat(request)).rejects.toMatchObject({ status: 503, code: "MODEL_NOT_FOUND" });
  });

  it("maps 5xx to AI_ERROR (502)", async () => {
    const { fn } = fakeFetch([jsonResponse(503, { error: { message: "overloaded", status: "UNAVAILABLE" } })]);
    await expect(new GemmaClient(cfg, fn).chat(request)).rejects.toMatchObject({ status: 502, code: "AI_ERROR" });
  });

  it("retries once without thinkingConfig when the model rejects it", async () => {
    const { fn, calls } = fakeFetch([
      jsonResponse(400, { error: { message: "Thinking config is not supported for this model", status: "INVALID_ARGUMENT" } }),
      jsonResponse(200, okBody("ok")),
    ]);
    const result = await new GemmaClient(cfg, fn).chat(request);
    expect(result.content).toBe("ok");
    expect(calls[0].body?.generationConfig).toHaveProperty("thinkingConfig");
    expect(calls[1].body?.generationConfig).not.toHaveProperty("thinkingConfig");
  });

  it("retries without JSON mode when the model rejects the MIME type", async () => {
    const { fn, calls } = fakeFetch([
      jsonResponse(400, { error: { message: "response_mime_type is not supported", status: "INVALID_ARGUMENT" } }),
      jsonResponse(200, okBody("{}")),
    ]);
    await new GemmaClient({ ...cfg, jsonMode: true, thinkingLevel: undefined }, fn).chat({ ...request, json: true });
    expect(calls[0].body?.generationConfig).toHaveProperty("responseMimeType");
    expect(calls[1].body?.generationConfig).not.toHaveProperty("responseMimeType");
  });
});
