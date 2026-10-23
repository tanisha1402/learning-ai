import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig (development)", () => {
  it("uses sensible defaults and does not require an API key", () => {
    const cfg = loadConfig({});
    expect(cfg.port).toBe(4000);
    expect(cfg.host).toBe("127.0.0.1");
    expect(cfg.isProduction).toBe(false);
    expect(cfg.gemma.apiKey).toBeUndefined();
    expect(cfg.gemma.baseUrl).toBe("https://generativelanguage.googleapis.com/v1beta");
    expect(cfg.gemma.model).toBe("gemma-4-26b-a4b-it");
    expect(cfg.gemma.thinkingLevel).toBe("minimal");
    expect(cfg.gemma.jsonMode).toBe(false);
    expect(cfg.limits.maxInputChars).toBe(12000);
    expect(cfg.corsOrigins).toContain("http://127.0.0.1:5173");
  });

  it("reads overrides, strips trailing slashes and 'models/' and treats empty strings as unset", () => {
    const cfg = loadConfig({
      GEMMA_API_KEY: "  test-key-123  ",
      GEMMA_BASE_URL: "https://example.test/v1beta/",
      GEMMA_MODEL: "models/gemma-4-31b-it",
      GEMMA_JSON_MODE: "true",
      GEMMA_THINKING_LEVEL: "off",
      PORT: "",
      MAX_INPUT_CHARS: "5000",
    });
    expect(cfg.gemma.apiKey).toBe("test-key-123");
    expect(cfg.gemma.baseUrl).toBe("https://example.test/v1beta");
    expect(cfg.gemma.model).toBe("gemma-4-31b-it");
    expect(cfg.gemma.jsonMode).toBe(true);
    expect(cfg.gemma.thinkingLevel).toBeUndefined();
    expect(cfg.port).toBe(4000);
    expect(cfg.limits.maxInputChars).toBe(5000);
  });

  it("throws a readable error for invalid values", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadConfig({ GEMMA_BASE_URL: "not a url" })).toThrow(/GEMMA_BASE_URL/);
    expect(() => loadConfig({ MIN_INPUT_CHARS: "500", MAX_INPUT_CHARS: "200" })).toThrow(/MIN_INPUT_CHARS/);
  });
});

describe("loadConfig (production / deployment)", () => {
  const prod = { NODE_ENV: "production", CORS_ORIGINS: "https://learn.example.app" };

  it("uses the platform PORT and binds 0.0.0.0 by default", () => {
    const cfg = loadConfig({ ...prod, PORT: "10000" });
    expect(cfg.port).toBe(10000);
    expect(cfg.host).toBe("0.0.0.0");
  });

  it("lets HOST be overridden", () => {
    expect(loadConfig({ ...prod, HOST: "127.0.0.1" }).host).toBe("127.0.0.1");
  });

  it("requires CORS_ORIGINS to be set", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/CORS_ORIGINS/);
  });

  it("rejects a wildcard CORS origin", () => {
    expect(() => loadConfig({ NODE_ENV: "production", CORS_ORIGINS: "*" })).toThrow(/CORS_ORIGINS/);
  });

  it("normalises origins (trailing slash, whitespace, several origins)", () => {
    const cfg = loadConfig({
      NODE_ENV: "production",
      CORS_ORIGINS: " https://a.example.app/ , https://b.example.app ",
    });
    expect(cfg.corsOrigins).toEqual(["https://a.example.app", "https://b.example.app"]);
  });
});
