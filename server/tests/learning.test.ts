import { describe, expect, it } from "vitest";
import { AppError } from "../src/errors";
import { LearningService } from "../src/learning";
import type { ChatOptions, ChatResult } from "../src/gemma";

const cfg = { model: "test-model", maxOutputTokensSummary: 1500, maxOutputTokensQuiz: 3000 };
const text = "Plants convert light energy into chemical energy during photosynthesis.";

const reply = (content: string): ChatResult => ({ content, outputTokens: 10, finishReason: "STOP" });
const validQuiz = JSON.stringify({
  questions: Array.from({ length: 5 }, (_, i) => ({
    question: `Question number ${i + 1}?`,
    options: ["one", "two", "three", "four"],
    correctIndex: 1,
    explanation: "Because the text says so.",
  })),
});

function service(replies: Array<ChatResult | Error | Promise<ChatResult>>) {
  const calls: ChatOptions[] = [];
  const gemma = {
    chat: async (opts: ChatOptions) => {
      calls.push(opts);
      const next = replies.shift();
      if (!next) throw new Error("no reply configured");
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { svc: new LearningService(gemma, cfg), calls };
}

describe("LearningService.generateSummary", () => {
  it("returns the cleaned model output with metadata", async () => {
    const { svc, calls } = service([reply("**A summary.**")]);
    const result = await svc.generateSummary(text, "short");
    expect(result.text).toBe("A summary.");
    expect(result.meta).toMatchObject({ model: "test-model", outputTokens: 10 });
    expect(calls[0].maxOutputTokens).toBe(400); // short-summary cap
  });

  it("fails with MODEL_EMPTY_RESPONSE on blank output", async () => {
    const { svc } = service([reply("   ")]);
    await expect(svc.generateSummary(text, "medium")).rejects.toMatchObject({ code: "MODEL_EMPTY_RESPONSE" });
  });
});

describe("LearningService.generateQuiz", () => {
  it("returns five validated questions", async () => {
    const { svc, calls } = service([reply(validQuiz)]);
    const result = await svc.generateQuiz(text, "easy");
    expect(result.questions).toHaveLength(5);
    expect(calls).toHaveLength(1);
    expect(calls[0].json).toBe(true); // JSON output was requested for the quiz
  });

  it("makes exactly one repair attempt when the first output is invalid", async () => {
    const { svc, calls } = service([reply("not json"), reply(validQuiz)]);
    const result = await svc.generateQuiz(text, "medium");
    expect(result.questions).toHaveLength(5);
    expect(calls).toHaveLength(2);
    expect(result.meta.outputTokens).toBe(20);
  });

  it("gives up with MODEL_OUTPUT_INVALID after the single repair attempt", async () => {
    const { svc, calls } = service([reply("bad"), reply('{"questions":[]}'), reply(validQuiz)]);
    await expect(svc.generateQuiz(text, "hard")).rejects.toMatchObject({ status: 502, code: "MODEL_OUTPUT_INVALID" });
    expect(calls).toHaveLength(2);
  });

  it("does not attempt a repair when the provider itself fails", async () => {
    const down = new AppError(503, "AI_UNREACHABLE", "down");
    const { svc, calls } = service([down]);
    await expect(svc.generateQuiz(text, "easy")).rejects.toBe(down);
    expect(calls).toHaveLength(1);
  });
});

describe("LearningService.generateAll", () => {
  it("runs the summary first and then the quiz, sequentially", async () => {
    const { svc, calls } = service([reply("Summary."), reply(validQuiz)]);
    const result = await svc.generateAll(text, "medium", "medium");
    expect(result.summary.text).toBe("Summary.");
    expect(result.quiz?.questions).toHaveLength(5);
    expect(result.quizError).toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls[0].json).toBeUndefined();
    expect(calls[1].json).toBe(true);
  });

  it("still returns the summary when the quiz fails", async () => {
    const { svc } = service([reply("Summary."), reply("bad"), reply("still bad")]);
    const result = await svc.generateAll(text, "short", "easy");
    expect(result.summary.text).toBe("Summary.");
    expect(result.quiz).toBeNull();
    expect(result.quizError).toMatch(/valid quiz/i);
  });
});

describe("LearningService concurrency guard", () => {
  it("rejects a second generation while one is running", async () => {
    let release!: (r: ChatResult) => void;
    const pending = new Promise<ChatResult>((resolve) => {
      release = resolve;
    });
    const { svc } = service([pending, reply("Second.")]);

    const first = svc.generateSummary(text, "short");
    await expect(svc.generateSummary(text, "short")).rejects.toMatchObject({ status: 429, code: "SERVER_BUSY" });

    release(reply("First."));
    await expect(first).resolves.toMatchObject({ text: "First." });
    // The lock is released afterwards.
    await expect(svc.generateSummary(text, "short")).resolves.toMatchObject({ text: "Second." });
  });
});
