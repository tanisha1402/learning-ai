import type { GemmaConfig } from "./config";
import { AppError } from "./errors";
import { cleanSummary, parseQuizOutput, QuizParseError } from "./parsing";
import type { GemmaClient } from "./gemma";
import { buildQuizMessages, buildQuizRepairMessages, buildSummaryMessages } from "./prompts";
import type {
  CombinedPayload,
  Difficulty,
  GenerationMeta,
  QuizPayload,
  SummaryLength,
  SummaryPayload,
} from "./types";

/** Upper bound on generated tokens per summary length (further capped by config). */
const SUMMARY_TOKEN_CAP: Record<SummaryLength, number> = { short: 400, medium: 800, detailed: 1400 };

export type LearningConfig = Pick<GemmaConfig, "model" | "maxOutputTokensSummary" | "maxOutputTokensQuiz">;

export class LearningService {
  private busy = false;

  constructor(
    private readonly ai: Pick<GemmaClient, "chat">,
    private readonly cfg: LearningConfig,
  ) {}

  /** Only one model run at a time: keeps a low-RAM PC responsive. */
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) {
      throw new AppError(429, "SERVER_BUSY", "Another generation is still running. Please wait for it to finish and try again.");
    }
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }

  private meta(startedAt: number, tokens: number | null): GenerationMeta {
    return { model: this.cfg.model, durationMs: Date.now() - startedAt, outputTokens: tokens };
  }

  private async runSummary(text: string, length: SummaryLength): Promise<SummaryPayload> {
    const startedAt = Date.now();
    const result = await this.ai.chat({
      messages: buildSummaryMessages(text, length),
      maxOutputTokens: Math.min(this.cfg.maxOutputTokensSummary, SUMMARY_TOKEN_CAP[length]),
    });
    const summary = cleanSummary(result.content);
    if (!summary) {
      throw new AppError(
        502,
        "MODEL_EMPTY_RESPONSE",
        "The model returned an empty summary. Please try again.",
      );
    }
    return { text: summary, length, meta: this.meta(startedAt, result.outputTokens) };
  }

  private async runQuiz(text: string, difficulty: Difficulty): Promise<QuizPayload> {
    const startedAt = Date.now();
    const first = await this.ai.chat({
      messages: buildQuizMessages(text, difficulty),
      json: true,
      maxOutputTokens: this.cfg.maxOutputTokensQuiz,
    });
    let tokens = first.outputTokens;

    try {
      const questions = parseQuizOutput(first.content);
      return { questions, difficulty, meta: this.meta(startedAt, tokens) };
    } catch (err) {
      if (!(err instanceof QuizParseError)) throw err;

      // Exactly ONE controlled repair attempt.
      const repaired = await this.ai.chat({
        messages: buildQuizRepairMessages(text, difficulty, first.content, err.message),
        json: true,
        maxOutputTokens: this.cfg.maxOutputTokensQuiz,
      });
      tokens = tokens !== null && repaired.outputTokens !== null ? tokens + repaired.outputTokens : repaired.outputTokens;
      try {
        const questions = parseQuizOutput(repaired.content);
        return { questions, difficulty, meta: this.meta(startedAt, tokens) };
      } catch {
        throw new AppError(
          502,
          "MODEL_OUTPUT_INVALID",
          "The model did not return a valid quiz (it must have 5 questions with 4 options each). Small models sometimes do this - please try again.",
        );
      }
    }
  }

  generateSummary(text: string, length: SummaryLength): Promise<SummaryPayload> {
    return this.exclusive(() => this.runSummary(text, length));
  }

  generateQuiz(text: string, difficulty: Difficulty): Promise<QuizPayload> {
    return this.exclusive(() => this.runQuiz(text, difficulty));
  }

  /** Summary first, then quiz - sequential, never in parallel. */
  generateAll(text: string, length: SummaryLength, difficulty: Difficulty): Promise<CombinedPayload> {
    return this.exclusive(async () => {
      const summary = await this.runSummary(text, length);
      try {
        const quiz = await this.runQuiz(text, difficulty);
        return { summary, quiz, quizError: null };
      } catch (err) {
        if (err instanceof AppError) return { summary, quiz: null, quizError: err.message };
        throw err;
      }
    });
  }
}
