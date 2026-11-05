import { BookOpen, FileText, ListChecks, Loader2, RotateCcw, Sparkles } from "lucide-react";
import type { Difficulty, SummaryLength } from "../types";
import { SegmentedControl } from "./SegmentedControl";
import { btnGhost, btnPrimary, btnSecondary, card } from "./ui";

interface Props {
  text: string;
  onTextChange: (value: string) => void;
  inputError: string | null;
  maxChars: number;
  minChars: number;
  summaryLength: SummaryLength;
  onSummaryLengthChange: (v: SummaryLength) => void;
  difficulty: Difficulty;
  onDifficultyChange: (v: Difficulty) => void;
  busy: boolean;
  onGenerateAll: () => void;
  onGenerateSummary: () => void;
  onGenerateQuiz: () => void;
  onLoadExample: () => void;
  onClear: () => void;
}

export function InputPanel(props: Props) {
  const { text, maxChars, minChars, busy } = props;
  const length = text.length;
  const overLimit = length > maxChars;
  const nearLimit = length > maxChars * 0.9;
  const counterColor = overLimit ? "text-rose-600 font-semibold" : nearLimit ? "text-amber-700" : "text-muted";

  return (
    <div className={`${card} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="source-text" className="font-display text-lg font-bold tracking-tight text-ink">
          Study material
        </label>
        <div className="flex items-center gap-1">
          <button type="button" className={btnGhost} onClick={props.onLoadExample} disabled={busy}>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Use example
          </button>
          <button type="button" className={btnGhost} onClick={props.onClear}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      <textarea
        id="source-text"
        value={text}
        onChange={(e) => props.onTextChange(e.target.value)}
        readOnly={busy}
        rows={12}
        placeholder="Paste a chapter, article or lecture notes here…"
        aria-describedby="source-text-help source-text-error"
        aria-invalid={props.inputError ? true : undefined}
        className={`mt-3 block w-full resize-y rounded-2xl border bg-mist px-4 py-3.5 text-sm leading-relaxed text-ink placeholder:text-muted/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet read-only:bg-lilac/60 ${
          props.inputError || overLimit ? "border-rose-300" : "border-line"
        }`}
      />

      <div className="mt-2 flex items-start justify-between gap-3 text-xs">
        <p id="source-text-help" className="text-muted">
          At least {minChars} characters. Your text is sent to the Gemma API, so avoid confidential material.
        </p>
        <p className={`shrink-0 tabular-nums ${counterColor}`} aria-live="polite">
          {length.toLocaleString()} / {maxChars.toLocaleString()}
        </p>
      </div>

      <div id="source-text-error" className="mt-2 text-sm text-rose-700" role="alert">
        {props.inputError}
        {!props.inputError && overLimit ? `Text is too long. Please shorten it to ${maxChars.toLocaleString()} characters.` : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <SegmentedControl
          legend="Summary length"
          name="summary-length"
          value={props.summaryLength}
          onChange={props.onSummaryLengthChange}
          disabled={busy}
          options={[
            { value: "short", label: "Short" },
            { value: "medium", label: "Medium" },
            { value: "detailed", label: "Detailed" },
          ]}
        />
        <SegmentedControl
          legend="Quiz difficulty"
          name="quiz-difficulty"
          value={props.difficulty}
          onChange={props.onDifficultyChange}
          disabled={busy}
          options={[
            { value: "easy", label: "Easy" },
            { value: "medium", label: "Medium" },
            { value: "hard", label: "Hard" },
          ]}
        />
      </div>

      <div className="mt-6 space-y-3">
        <button type="button" className={`${btnPrimary} w-full`} onClick={props.onGenerateAll} disabled={busy || overLimit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4 text-coral" aria-hidden="true" />}
          {busy ? "Generating…" : "Generate summary and quiz"}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={btnSecondary} onClick={props.onGenerateSummary} disabled={busy || overLimit}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Summary only
          </button>
          <button type="button" className={btnSecondary} onClick={props.onGenerateQuiz} disabled={busy || overLimit}>
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            Quiz only
          </button>
        </div>
      </div>
    </div>
  );
}
