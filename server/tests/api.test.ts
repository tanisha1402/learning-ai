import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { AppError } from "../src/errors";
import type { GemmaClient, ProviderState } from "../src/gemma";
import type { LearningService } from "../src/learning";
import { buildRequestSchemas } from "../src/schemas";

const config = loadConfig({
  NODE_ENV: "production",
  CORS_ORIGINS: "https://learn.example.app",
  MIN_INPUT_CHARS: "10",
  MAX_INPUT_CHARS: "200",
});

let state: ProviderState = "ready";
const gemma = { getStatus: async () => ({ state }) } as unknown as GemmaClient;

const meta = { model: "m", durationMs: 5, outputTokens: 3 };
const learning = {
  generateSummary: async (_t: string, length: string) => ({ text: "A summary.", length, meta }),
  generateQuiz: async () => {
    throw new AppError(502, "MODEL_OUTPUT_INVALID", "bad quiz");
  },
  generateAll: async () => {
    throw new Error("secret internal detail");
  },
} as unknown as LearningService;

let server: Server;
let base = "";

beforeAll(async () => {
  const app = createApp({ config, gemma, learning, schemas: buildRequestSchemas(config.limits) });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("health", () => {
  it("GET /health/live is always 200", async () => {
    state = "unreachable";
    const res = await fetch(`${base}/health/live`);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });

  it("GET /health returns 200 when the provider is ready", async () => {
    state = "ready";
    const res = await fetch(`${base}/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      provider: { name: "Google Gemini API", state: "ready" },
      limits: { maxInputChars: 200, minInputChars: 10 },
    });
    expect(JSON.stringify(body)).not.toMatch(/api[_-]?key=/i);
  });

  it.each(["not_configured", "auth_failed", "model_not_found", "rate_limited", "unreachable", "error"] as const)(
    "GET /health returns 503 degraded for %s",
    async (s) => {
      state = s;
      const res = await fetch(`${base}/health`);
      const body = await res.json();
      expect(res.status).toBe(503);
      expect(body).toMatchObject({ status: "degraded", provider: { state: s } });
      expect(typeof body.message).toBe("string");
    },
  );
});

describe("learning routes", () => {
  it("returns the summary in the documented shape", async () => {
    const res = await post("/learning/generate-summary", { text: "Plants make food using light.", summaryLength: "short" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: { text: "A summary.", length: "short", meta } });
  });

  it("validates input with a consistent error body", async () => {
    const res = await post("/learning/generate-summary", { text: "short" });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("rejects malformed JSON", async () => {
    const res = await post("/learning/generate-summary", "{not json");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_JSON");
  });

  it("passes AppError status and code through", async () => {
    const res = await post("/learning/generate-quiz", { text: "Plants make food using light." });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatchObject({ code: "MODEL_OUTPUT_INVALID", message: "bad quiz" });
  });

  it("hides internal error details", async () => {
    const res = await post("/learning/generate", { text: "Plants make food using light." });
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).toContain("INTERNAL_ERROR");
    expect(text).not.toContain("secret internal detail");
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });
});

describe("CORS", () => {
  it("allows the configured frontend origin", async () => {
    const res = await fetch(`${base}/health/live`, { headers: { Origin: "https://learn.example.app" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://learn.example.app");
  });

  it("does not allow other origins", async () => {
    const res = await fetch(`${base}/health/live`, { headers: { Origin: "https://evil.example" } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
