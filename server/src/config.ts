import { z } from "zod";

export interface GemmaConfig {
  /** Secret. Server-side only. Optional so the server can start and report "not configured" via /health. */
  apiKey?: string;
  baseUrl: string;
  /** Model id without the "models/" prefix, e.g. "gemma-4-26b-a4b-it". */
  model: string;
  timeoutMs: number;
  temperature: number;
  maxOutputTokensSummary: number;
  maxOutputTokensQuiz: number;
  /** Gemma 4 thinking level sent as generationConfig.thinkingConfig.thinkingLevel. undefined = omit. */
  thinkingLevel?: string;
  /** Ask the API for responseMimeType=application/json on quiz requests (unverified for Gemma; off by default). */
  jsonMode: boolean;
}

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  host: string;
  port: number;
  corsOrigins: string[];
  limits: { maxInputChars: number; minInputChars: number };
  gemma: GemmaConfig;
}

/** Treat empty strings (e.g. `PORT=`) as "not set" so defaults apply. */
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const intVar = (def: number, min: number, max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).default(def));

const floatVar = (def: number, min: number, max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().min(min).max(max).default(def));

const strVar = (def: string) => z.preprocess(emptyToUndefined, z.string().trim().min(1).default(def));

const boolVar = (def: boolean) =>
  z.preprocess(
    (v) => {
      const x = emptyToUndefined(v);
      return typeof x === "string" ? ["true", "1", "yes", "on"].includes(x.trim().toLowerCase()) : x;
    },
    z.boolean().default(def),
  );

const envSchema = z.object({
  NODE_ENV: strVar("development"),
  HOST: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  PORT: intVar(4000, 1, 65535),
  CORS_ORIGINS: z.preprocess(emptyToUndefined, z.string().trim().optional()),

  GEMMA_API_KEY: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  GEMMA_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().trim().url().default("https://generativelanguage.googleapis.com/v1beta"),
  ),
  GEMMA_MODEL: strVar("gemma-4-26b-a4b-it"),
  GEMMA_TIMEOUT_MS: intVar(60_000, 1_000, 300_000),
  GEMMA_TEMPERATURE: floatVar(0.3, 0, 2),
  GEMMA_MAX_OUTPUT_TOKENS_SUMMARY: intVar(1500, 64, 8192),
  GEMMA_MAX_OUTPUT_TOKENS_QUIZ: intVar(3000, 256, 8192),
  GEMMA_THINKING_LEVEL: strVar("minimal"),
  GEMMA_JSON_MODE: boolVar(false),

  MAX_INPUT_CHARS: intVar(12_000, 100, 200_000),
  MIN_INPUT_CHARS: intVar(50, 1, 5_000),
});

const DEV_CORS = "http://127.0.0.1:5173,http://localhost:5173";

function fail(lines: string[]): never {
  throw new Error(`Invalid environment configuration:\n${lines.map((l) => ` - ${l}`).join("\n")}`);
}

/** Parse and validate environment variables. Pure function: easy to test. */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === "production";

  if (e.MIN_INPUT_CHARS >= e.MAX_INPUT_CHARS) {
    fail(["MIN_INPUT_CHARS must be smaller than MAX_INPUT_CHARS"]);
  }

  // Origins are compared with the browser's Origin header, which never has a trailing slash.
  const corsOrigins = (e.CORS_ORIGINS ?? (isProduction ? "" : DEV_CORS))
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (isProduction) {
    if (corsOrigins.length === 0) {
      fail(["CORS_ORIGINS must be set in production (e.g. https://your-app.vercel.app)"]);
    }
    if (corsOrigins.includes("*")) {
      fail(["CORS_ORIGINS must not contain '*' in production; list the exact frontend origin(s)"]);
    }
  }

  const level = e.GEMMA_THINKING_LEVEL.trim();
  return {
    nodeEnv: e.NODE_ENV,
    isProduction,
    // Hosting platforms (Render, etc.) need 0.0.0.0; locally 127.0.0.1 keeps it private.
    host: e.HOST ?? (isProduction ? "0.0.0.0" : "127.0.0.1"),
    port: e.PORT,
    corsOrigins,
    limits: { maxInputChars: e.MAX_INPUT_CHARS, minInputChars: e.MIN_INPUT_CHARS },
    gemma: {
      apiKey: e.GEMMA_API_KEY,
      baseUrl: e.GEMMA_BASE_URL.replace(/\/+$/, ""),
      model: e.GEMMA_MODEL.replace(/^models\//, ""),
      timeoutMs: e.GEMMA_TIMEOUT_MS,
      temperature: e.GEMMA_TEMPERATURE,
      maxOutputTokensSummary: e.GEMMA_MAX_OUTPUT_TOKENS_SUMMARY,
      maxOutputTokensQuiz: e.GEMMA_MAX_OUTPUT_TOKENS_QUIZ,
      thinkingLevel: ["off", "none"].includes(level.toLowerCase()) ? undefined : level,
      jsonMode: e.GEMMA_JSON_MODE,
    },
  };
}
