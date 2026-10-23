import { describe, expect, it } from "vitest";
import { cleanSummary, extractJson, parseQuizOutput, QuizParseError, shuffleOptions } from "../src/parsing";

const question = (over: Record<string, unknown> = {}) => ({
  question: "What does the chloroplast do?",
  options: ["Makes energy", "Stores water", "Moves cells", "Copies DNA"],
  correctIndex: 0,
  explanation: "The text says chloroplasts capture light energy.",
  ...over,
});
const quiz = (count = 5) => ({
  questions: Array.from({ length: count }, (_, i) => question({ question: `Question number ${i + 1}?` })),
});
const json = (v: unknown) => JSON.stringify(v);

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses JSON inside a code fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("parses JSON surrounded by chatter", () => {
    expect(extractJson('Sure! Here you go: {"a":1} Hope that helps.')).toEqual({ a: 1 });
  });
  it("throws QuizParseError for garbage and empty output", () => {
    expect(() => extractJson("not json at all")).toThrow(QuizParseError);
    expect(() => extractJson("   ")).toThrow(QuizParseError);
  });
});

describe("parseQuizOutput", () => {
  it("accepts a valid quiz and assigns ids", () => {
    const result = parseQuizOutput(json(quiz()));
    expect(result).toHaveLength(5);
    expect(result.map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    for (const q of result) {
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);
    }
  });

  it("keeps the correct answer text correct after shuffling", () => {
    const result = parseQuizOutput(json(quiz()), () => 0.3);
    for (const q of result) expect(q.options[q.correctIndex]).toBe("Makes energy");
  });

  it("accepts a top-level array and numeric-string correctIndex", () => {
    const raw = json(quiz().questions.map((q) => ({ ...q, correctIndex: "2" })));
    const result = parseQuizOutput(raw, () => 0);
    for (const q of result) expect(q.options[q.correctIndex]).toBe("Moves cells");
  });

  it("strips A) / B) prefixes only when all options have them", () => {
    const prefixed = quiz();
    prefixed.questions[0].options = ["A) Makes energy", "B) Stores water", "C) Moves cells", "D) Copies DNA"];
    const result = parseQuizOutput(json(prefixed), () => 0);
    expect(result[0].options.some((o) => /^[A-D]\)/.test(o))).toBe(false);
  });

  it.each([
    ["4 questions", quiz(4)],
    ["6 questions", quiz(6)],
    ["3 options", { questions: quiz().questions.map((q) => ({ ...q, options: ["a", "b", "c"] })) }],
    ["5 options", { questions: quiz().questions.map((q) => ({ ...q, options: ["a", "b", "c", "d", "e"] })) }],
    ["correctIndex 4", { questions: quiz().questions.map((q) => ({ ...q, correctIndex: 4 })) }],
    ["correctIndex -1", { questions: quiz().questions.map((q) => ({ ...q, correctIndex: -1 })) }],
    ["missing explanation", { questions: quiz().questions.map(({ explanation: _e, ...rest }) => rest) }],
    ["duplicate options", { questions: quiz().questions.map((q) => ({ ...q, options: ["a", "A", "c", "d"] })) }],
    ["empty option", { questions: quiz().questions.map((q) => ({ ...q, options: ["a", " ", "c", "d"] })) }],
  ])("rejects %s", (_name, value) => {
    expect(() => parseQuizOutput(json(value))).toThrow(QuizParseError);
  });

  it("rejects non-JSON output", () => {
    expect(() => parseQuizOutput("Here is your quiz!")).toThrow(QuizParseError);
  });
});

describe("shuffleOptions", () => {
  it("is a permutation and tracks the correct index", () => {
    const options = ["w", "x", "y", "z"];
    for (let correct = 0; correct < 4; correct++) {
      const r = shuffleOptions(options, correct, () => 0.7);
      expect([...r.options].sort()).toEqual(["w", "x", "y", "z"]);
      expect(r.options[r.correctIndex]).toBe(options[correct]);
    }
  });
});

describe("cleanSummary", () => {
  it("removes code fences, bold markers and headings", () => {
    const out = cleanSummary("```\n# Title\n**Bold** text\n* point\n```");
    expect(out).toBe("Title\nBold text\n- point");
  });
  it("returns an empty string for blank output", () => {
    expect(cleanSummary("  \n ")).toBe("");
  });
});
