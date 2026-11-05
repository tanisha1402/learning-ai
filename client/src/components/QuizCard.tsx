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
        <h2 id="quiz-heading" className="flex items-center gap-3 font-display text-lg font-bold tracking-tight text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lilac text-violet">
            <ListChecks className="h-5 w-5" aria-hidden="true" />
          </span>
          Quiz
        </h2>
        {panel.status === "success" && panel.data ? (
          <p className="rounded-full bg-lilac px-3 py-1 text-xs font-semibold capitalize text-violet">{panel.data.difficulty} difficulty</p>
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
                className={`mb-6 flex items-center gap-4 rounded-2xl border p-4 ${
                  result.percentage >= 60 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-2xl bg-ink px-3 font-display text-2xl font-extrabold tabular-nums text-white" aria-hidden="true">
                  {result.score}/{result.total}
                </p>
                <div>
                  <p className="font-display text-lg font-bold text-ink">
                    You scored {result.score} out of {result.total} ({result.percentage}%)
                  </p>
                  <p className="mt-0.5 text-sm text-muted">Review the correct answers and explanations below.</p>
                </div>
              </div>
            )}

            <ol className="space-y-8">
              {questions.map((q, qi) => {
                const selected = answers[q.id];
                const hasSelected = Number.isInteger(selected);
                return (
                  <li key={q.id}>
                    <fieldset disabled={submitted}>
                      <legend className="text-base font-semibold leading-6 text-ink">
                        <span className="mr-2 font-extrabold tabular-nums text-violet">{qi + 1}.</span>
                        {q.question}
                      </legend>
                      <div className="mt-3 space-y-2.5">
                        {q.options.map((option, oi) => {
                          const isSelected = hasSelected && selected === oi;
                          const isCorrect = oi === q.correctIndex;
                          let tone = "border-line hover:border-violet/50 hover:bg-mist";
                          let badge = "bg-lilac text-violet";
                          if (!submitted && isSelected) {
                            tone = "border-violet bg-lilac shadow-[inset_0_0_0_1px_#6b3184]";
                            badge = "bg-ink text-white";
                          }
                          if (submitted && isCorrect) {
                            tone = "border-emerald-300 bg-emerald-50";
                            badge = "bg-emerald-700 text-white";
                          } else if (submitted && isSelected) {
                            tone = "border-rose-300 bg-rose-50";
                            badge = "bg-rose-700 text-white";
                          } else if (submitted) {
                            tone = "border-line text-muted";
                            badge = "bg-mist text-muted";
                          }

                          return (
                            <label
                              key={oi}
                              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition focus-within:ring-2 focus-within:ring-violet focus-within:ring-offset-1 ${
                                submitted ? "cursor-default" : "cursor-pointer"
                              } ${tone}`}
                            >
                              <input
                                type="radio"
                                name={`question-${q.id}`}
                                value={oi}
                                checked={isSelected}
                                onChange={() => onSelect(q.id, oi)}
                                className="peer sr-only"
                              />
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold transition ${badge}`}
                                aria-hidden="true"
                              >
                                {LETTERS[oi]}
                              </span>
                              <span className="flex-1 leading-6">{option}</span>
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
                      <p className="mt-2.5 rounded-xl border-l-4 border-violet bg-lilac/70 px-4 py-3 text-sm leading-6 text-ink">
                        <span className="font-bold">Why: </span>
                        {q.explanation}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              {!submitted ? (
                <>
                  <button type="button" className={btnPrimary} onClick={onSubmit} disabled={!complete}>
                    Submit quiz
                  </button>
                  <p className="text-sm font-medium text-muted" aria-live="polite">
                    {answered} of {questions.length} answered
                  </p>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-lilac" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-coral transition-all"
                      style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }}
                    />
                  </span>
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
            <p className="mt-4 text-xs text-muted">
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
