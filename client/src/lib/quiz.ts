import type { QuizQuestion } from "../types";

/** Map of question id -> selected option index. */
export type Answers = Record<string, number>;

export interface QuestionResult {
  id: string;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
}

export interface QuizScore {
  score: number;
  total: number;
  percentage: number;
  results: QuestionResult[];
}

export function countAnswered(questions: QuizQuestion[], answers: Answers): number {
  return questions.filter((q) => Number.isInteger(answers[q.id])).length;
}

export function allAnswered(questions: QuizQuestion[], answers: Answers): boolean {
  return questions.length > 0 && countAnswered(questions, answers) === questions.length;
}

export function scoreQuiz(questions: QuizQuestion[], answers: Answers): QuizScore {
  const results = questions.map((q) => {
    const selected = answers[q.id];
    const selectedIndex = Number.isInteger(selected) ? selected : null;
    return { id: q.id, selectedIndex, correctIndex: q.correctIndex, isCorrect: selectedIndex === q.correctIndex };
  });
  const score = results.filter((r) => r.isCorrect).length;
  const total = questions.length;
  return { score, total, percentage: total === 0 ? 0 : Math.round((score / total) * 100), results };
}
