import { z } from "zod";
import { DIFFICULTIES, SUMMARY_LENGTHS } from "./types";

/** Request-body schemas. Built from config so the limits stay configurable. */
export function buildRequestSchemas(limits: { maxInputChars: number; minInputChars: number }) {
  const text = z
    .string({ required_error: "Text is required.", invalid_type_error: "Text must be a string." })
    .trim()
    .min(1, "Please provide some educational text.")
    .min(limits.minInputChars, `Text is too short. Please provide at least ${limits.minInputChars} characters.`)
    .max(limits.maxInputChars, `Text is too long. The maximum is ${limits.maxInputChars} characters.`);

  const summaryLength = z
    .enum(SUMMARY_LENGTHS, {
      errorMap: () => ({ message: `summaryLength must be one of: ${SUMMARY_LENGTHS.join(", ")}.` }),
    })
    .default("medium");

  const difficulty = z
    .enum(DIFFICULTIES, {
      errorMap: () => ({ message: `difficulty must be one of: ${DIFFICULTIES.join(", ")}.` }),
    })
    .default("medium");

  return {
    generateSummary: z.object({ text, summaryLength }),
    generateQuiz: z.object({ text, difficulty }),
    generateAll: z.object({ text, summaryLength, difficulty }),
  };
}

export type RequestSchemas = ReturnType<typeof buildRequestSchemas>;

/**
 * Schema for ONE quiz as returned by the model (untrusted input).
 * Enforces: exactly 5 questions, exactly 4 distinct options each,
 * and exactly one correct answer (a single index from 0 to 3).
 */
const correctIndex = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
  z.number().int().min(0).max(3),
);

export const quizQuestionSchema = z
  .object({
    question: z.string().trim().min(5),
    options: z.array(z.string().trim().min(1)).length(4),
    correctIndex,
    explanation: z.string().trim().min(1),
  })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, {
    message: "options must be distinct",
    path: ["options"],
  });

export const QUIZ_QUESTION_COUNT = 5;

export const quizSchema = z.object({
  questions: z.array(quizQuestionSchema).length(QUIZ_QUESTION_COUNT),
});
