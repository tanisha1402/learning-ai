import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "../types";
import { allAnswered, countAnswered, scoreQuiz } from "./quiz";

const questions: QuizQuestion[] = [0, 1, 2, 3, 4].map((i) => ({
  id: `q${i + 1}`,
  question: `Question ${i + 1}?`,
  options: ["a", "b", "c", "d"],
  correctIndex: i % 4,
  explanation: "Because.",
}));

describe("quiz helpers", () => {
  it("counts answered questions (index 0 counts as answered)", () => {
    expect(countAnswered(questions, {})).toBe(0);
    expect(countAnswered(questions, { q1: 0, q2: 3 })).toBe(2);
  });

  it("knows when every question is answered", () => {
    expect(allAnswered(questions, { q1: 0, q2: 1, q3: 2, q4: 3 })).toBe(false);
    expect(allAnswered(questions, { q1: 0, q2: 1, q3: 2, q4: 3, q5: 0 })).toBe(true);
    expect(allAnswered([], {})).toBe(false);
  });

  it("scores a perfect attempt", () => {
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correctIndex]));
    const result = scoreQuiz(questions, answers);
    expect(result).toMatchObject({ score: 5, total: 5, percentage: 100 });
    expect(result.results.every((r) => r.isCorrect)).toBe(true);
  });

  it("scores a mixed attempt and reports each selection", () => {
    const result = scoreQuiz(questions, { q1: 0, q2: 0, q3: 2, q4: 0, q5: 0 });
    expect(result.score).toBe(3); // q1, q3, q5 correct
    expect(result.percentage).toBe(60);
    expect(result.results[1]).toEqual({ id: "q2", selectedIndex: 0, correctIndex: 1, isCorrect: false });
  });

  it("treats unanswered questions as incorrect", () => {
    const result = scoreQuiz(questions, { q1: 0 });
    expect(result.score).toBe(1);
    expect(result.results[1].selectedIndex).toBeNull();
  });

  it("handles an empty quiz", () => {
    expect(scoreQuiz([], {})).toMatchObject({ score: 0, total: 0, percentage: 0 });
  });
});
