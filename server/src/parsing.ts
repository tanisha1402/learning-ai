import type { ZodError } from "zod";
import { quizSchema } from "./schemas";
import type { QuizQuestion } from "./types";

/** Thrown when model output cannot be turned into a valid quiz. */
export class QuizParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizParseError";
  }
}

/** Pull a JSON value out of model text (handles ```json fences and chatter around the JSON). */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new QuizParseError("The model returned an empty response.");

  const candidates: string[] = [trimmed];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  throw new QuizParseError("The model output was not valid JSON.");
}

const LETTER_PREFIX = /^\(?[A-Da-d][).:]\s+/;

/** Remove "A) ", "B. " style prefixes, but only when ALL four options have one. */
function stripOptionPrefixes(options: unknown): unknown {
  if (!Array.isArray(options) || options.length !== 4) return options;
  if (!options.every((o) => typeof o === "string")) return options;
  const strings = options as string[];
  return strings.every((o) => LETTER_PREFIX.test(o.trim()))
    ? strings.map((o) => o.trim().replace(LETTER_PREFIX, ""))
    : options;
}

function normalize(data: unknown): unknown {
  if (Array.isArray(data)) return normalize({ questions: data });
  if (typeof data !== "object" || data === null) return data;
  const obj = data as { questions?: unknown };
  if (!Array.isArray(obj.questions)) return data;
  return {
    ...obj,
    questions: obj.questions.map((q: unknown) =>
      typeof q === "object" && q !== null
        ? { ...(q as Record<string, unknown>), options: stripOptionPrefixes((q as Record<string, unknown>).options) }
        : q,
    ),
  };
}

function describeIssues(error: ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/** Fisher-Yates shuffle of the options that keeps track of the correct answer. */
export function shuffleOptions(
  options: string[],
  correctIndex: number,
  rng: () => number = Math.random,
): { options: string[]; correctIndex: number } {
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { options: order.map((i) => options[i]), correctIndex: order.indexOf(correctIndex) };
}

/**
 * Parse + validate untrusted model output into exactly five questions.
 * Options are shuffled (small models love putting the right answer first).
 */
export function parseQuizOutput(raw: string, rng: () => number = Math.random): QuizQuestion[] {
  const data = normalize(extractJson(raw));
  const result = quizSchema.safeParse(data);
  if (!result.success) throw new QuizParseError(describeIssues(result.error));

  return result.data.questions.map((q, i) => {
    const shuffled = shuffleOptions(q.options, q.correctIndex, rng);
    return {
      id: `q${i + 1}`,
      question: q.question,
      options: shuffled.options,
      correctIndex: shuffled.correctIndex,
      explanation: q.explanation,
    };
  });
}

/** Light clean-up of a plain-text summary (the model sometimes adds markdown anyway). */
export function cleanSummary(raw: string): string {
  return raw
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/, "")
    .replace(/\*\*/g, "")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*\*[ \t]+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
