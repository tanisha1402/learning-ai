import { describe, expect, it } from "vitest";
import { buildRequestSchemas } from "../src/schemas";

const schemas = buildRequestSchemas({ minInputChars: 10, maxInputChars: 100 });
const validText = "This is some educational text.";

describe("request schemas", () => {
  it("accepts valid input and applies defaults", () => {
    const summary = schemas.generateSummary.parse({ text: validText });
    expect(summary.summaryLength).toBe("medium");
    const quiz = schemas.generateQuiz.parse({ text: validText });
    expect(quiz.difficulty).toBe("medium");
    const all = schemas.generateAll.parse({ text: validText, summaryLength: "short", difficulty: "hard" });
    expect(all).toMatchObject({ summaryLength: "short", difficulty: "hard" });
  });

  it("trims text", () => {
    expect(schemas.generateSummary.parse({ text: `   ${validText}   ` }).text).toBe(validText);
  });

  it("rejects missing, empty and whitespace-only text", () => {
    expect(schemas.generateSummary.safeParse({}).success).toBe(false);
    expect(schemas.generateSummary.safeParse({ text: "" }).success).toBe(false);
    expect(schemas.generateSummary.safeParse({ text: "     " }).success).toBe(false);
  });

  it("rejects text outside the configured limits", () => {
    expect(schemas.generateQuiz.safeParse({ text: "short" }).success).toBe(false);
    expect(schemas.generateQuiz.safeParse({ text: "x".repeat(101) }).success).toBe(false);
    expect(schemas.generateQuiz.safeParse({ text: "x".repeat(100) }).success).toBe(true);
  });

  it("rejects invalid enum values and wrong types", () => {
    expect(schemas.generateSummary.safeParse({ text: validText, summaryLength: "huge" }).success).toBe(false);
    expect(schemas.generateQuiz.safeParse({ text: validText, difficulty: "impossible" }).success).toBe(false);
    expect(schemas.generateQuiz.safeParse({ text: 42 }).success).toBe(false);
  });
});
