import { CheckCircle2, ListChecks, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { useMemo } from "react";
import { allAnswered, countAnswered, scoreQuiz, type Answers } from "../lib/quiz";
import type { Panel, QuizPayload } from "../types";
import { EmptyState } from "./EmptyState";
import { ErrorMessage } from "./ErrorMessage";
import { LoadingState } from "./LoadingState";
import { btnPrimary, btnSecondary, card } from "./ui";

interface Props {
  panel: Panel<QuizPayload>;
  model: string;
  queued: boolean;
  answers: Answers;
  submitted: boolean;
  busy: boolean;
  onSelect: (questionId: string, optionIndex: number) => void;
  onSubmit: () => void;
  onRetake: () => void;
  onNewQuiz: () => void;
}

const LETTERS = ["A", "B", "C", "D"];

export function QuizCard({ panel, model, queued, answers, submitted, busy, onSelect, onSubmit, onRetake, onNewQuiz }: Props) {
  const questions = panel.data?.questions ?? [];
  const answered = countAnswered(questions, answers);
  const complete = allAnswered(questions, answers);
  const result = useMemo(() => (submitted ? scoreQuiz(questions, answers) : null), [submitted, questions, answers]);

  return (
    <section className={`${card} p-5 sm:p-6`} aria-labelledby="quiz-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="quiz-heading" className="text-base font-semibold text-slate-900">
          Quiz
        </h2>
        {panel.status === "success" && panel.data ? (
          <p className="text-sm text-slate-500 capitalize">{panel.data.difficulty} difficulty</p>
        ) : null}
      </div>

      <div className="mt-4">
        {panel.status === "idle" && (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
            title="No quiz yet"
            description="Generate a five-question multiple-choice quiz from your material to test what you remember."
          />
        )}

        {panel.status === "loading" && (
          <LoadingState
            message={queued ? "Waiting for the summary to finish…" : `Writing questions with ${model}…`}
            detail={
              queued
                ? "One request at a time keeps usage within the free-tier limits."
                : "Quiz generation takes longer than a summary."
            }
          />
        )}

        {panel.status === "error" && <ErrorMessage title="Could not generate the quiz" message={panel.error ?? "Unknown error."} />}

        {panel.status === "success" && panel.data && (
          <div>
            {result && (
              <div
                role="status"
                className={`mb-5 rounded-xl border p-4 ${
                  result.percentage >= 60 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="text-lg font-semibold text-slate-900">
                  You scored {result.score} out of {result.total} ({result.percentage}%)
                </p>
                <p className="mt-0.5 text-sm text-slate-600">Review the correct answers and explanations below.</p>
              </div>
            )}

            <ol className="space-y-6">
              {questions.map((q, qi) => {
                const selected = answers[q.id];
                const hasSelected = Number.isInteger(selected);
                return (
                  <li key={q.id}>
                    <fieldset disabled={submitted}>
                      <legend className="text-[15px] font-medium leading-6 text-slate-900">
                        <span className="mr-1.5 text-slate-500">{qi + 1}.</span>
                        {q.question}
                      </legend>
                      <div className="mt-2.5 space-y-2">
                        {q.options.map((option, oi) => {
                          const isSelected = hasSelected && selected === oi;
                          const isCorrect = oi === q.correctIndex;
                          let tone = "border-slate-200 hover:border-indigo-300 hover:bg-slate-50";
                          if (!submitted && isSelected) tone = "border-indigo-500 bg-indigo-50";
                          if (submitted && isCorrect) tone = "border-emerald-300 bg-emerald-50";
                          else if (submitted && isSelected) tone = "border-rose-300 bg-rose-50";
                          else if (submitted) tone = "border-slate-200 text-slate-500";

                          return (
                            <label
                              key={oi}
                              className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition focus-within:ring-2 focus-within:ring-indigo-500 ${
                                submitted ? "cursor-default" : "cursor-pointer"
                              } ${tone}`}
                            >
                              <input
                                type="radio"
                                name={`question-${q.id}`}
                                value={oi}
                                checked={isSelected}
                                onChange={() => onSelect(q.id, oi)}
                                className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                              />
                              <span className="flex-1 leading-6">
                                <span className="mr-1.5 font-medium text-slate-500">{LETTERS[oi]}.</span>
                                {option}
                              </span>
                              {submitted && isCorrect && (
                                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                  Correct answer
                                </span>
                              )}
                              {submitted && isSelected && !isCorrect && (
                                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-rose-700">
                                  <XCircle className="h-4 w-4" aria-hidden="true" />
                                  Your answer
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    {submitted && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm leading-6 text-slate-700">
                        <span className="font-medium text-slate-900">Why: </span>
                        {q.explanation}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              {!submitted ? (
                <>
                  <button type="button" className={btnPrimary} onClick={onSubmit} disabled={!complete}>
                    Submit quiz
                  </button>
                  <p className="text-sm text-slate-500" aria-live="polite">
                    {answered} of {questions.length} answered
                  </p>
                </>
              ) : (
                <>
                  <button type="button" className={btnSecondary} onClick={onRetake}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Retake quiz
                  </button>
                  <button type="button" className={btnSecondary} onClick={onNewQuiz} disabled={busy}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    New questions
                  </button>
                </>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Generated by {panel.data.meta.model} in {(panel.data.meta.durationMs / 1000).toFixed(1)}s
              {panel.data.meta.outputTokens !== null ? ` (${panel.data.meta.outputTokens} tokens)` : ""}. Answers are not
              guaranteed to be correct, so check them against your source.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
