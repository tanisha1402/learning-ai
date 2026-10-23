import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, generateQuiz, generateSummary, getHealth } from "./api/client";
import { Header, type HealthView } from "./components/Header";
import { InputPanel } from "./components/InputPanel";
import { QuizCard } from "./components/QuizCard";
import { SummaryCard } from "./components/SummaryCard";
import type { Answers } from "./lib/quiz";
import { SAMPLE_TEXT } from "./lib/sampleText";
import type { Difficulty, Panel, QuizPayload, SummaryLength, SummaryPayload } from "./types";

const DEFAULT_LIMITS = { maxInputChars: 12000, minInputChars: 50 };

function emptyPanel<T>(): Panel<T> {
  return { status: "idle", data: null, error: null };
}

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export default function App() {
  const [text, setText] = useState("");
  const [summaryLength, setSummaryLength] = useState<SummaryLength>("medium");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [inputError, setInputError] = useState<string | null>(null);

  const [summary, setSummary] = useState<Panel<SummaryPayload>>(emptyPanel);
  const [quiz, setQuiz] = useState<Panel<QuizPayload>>(emptyPanel);
  const [quizQueued, setQuizQueued] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);

  const [health, setHealth] = useState<HealthView>({ kind: "checking" });
  const [modelName, setModelName] = useState("the model");
  const [limits, setLimits] = useState(DEFAULT_LIMITS);

  // Incremented on every new run / clear so that late responses from old runs are ignored.
  const runRef = useRef(0);

  const busy = summary.status === "loading" || quiz.status === "loading";

  const refreshHealth = useCallback(async () => {
    setHealth({ kind: "checking" });
    try {
      const h = await getHealth();
      setLimits(h.limits);
      setModelName(h.provider.model);
      switch (h.provider.state) {
        case "ready":
          setHealth({ kind: "ready", model: h.provider.model });
          break;
        case "not_configured":
          setHealth({ kind: "not-configured" });
          break;
        case "auth_failed":
          setHealth({ kind: "auth-failed" });
          break;
        case "model_not_found":
          setHealth({ kind: "model-missing", model: h.provider.model });
          break;
        case "rate_limited":
          setHealth({ kind: "rate-limited" });
          break;
        default:
          setHealth({ kind: "provider-down" });
      }
    } catch {
      setHealth({ kind: "backend-down" });
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  function validateInput(): string | null {
    const trimmed = text.trim();
    if (!trimmed) return "Paste some study material first, or choose “Use example”.";
    if (trimmed.length < limits.minInputChars) {
      return `Add a bit more text. At least ${limits.minInputChars} characters are needed for a useful summary and quiz.`;
    }
    if (text.length > limits.maxInputChars) {
      return `Text is too long. Please shorten it to ${limits.maxInputChars.toLocaleString()} characters.`;
    }
    return null;
  }

  /** Validates input and starts a new run. Returns the run id, or null if input is invalid. */
  function startRun(): number | null {
    const problem = validateInput();
    setInputError(problem);
    if (problem) return null;
    runRef.current += 1;
    return runRef.current;
  }

  async function runSummary(runId: number): Promise<boolean> {
    setSummary({ status: "loading", data: null, error: null });
    try {
      const data = await generateSummary(text.trim(), summaryLength);
      if (runRef.current !== runId) return false;
      setSummary({ status: "success", data, error: null });
      return true;
    } catch (err) {
      if (runRef.current === runId) setSummary({ status: "error", data: null, error: messageOf(err) });
      return false;
    }
  }

  async function runQuiz(runId: number): Promise<void> {
    setQuizQueued(false);
    setQuiz({ status: "loading", data: null, error: null });
    setAnswers({});
    setSubmitted(false);
    try {
      const data = await generateQuiz(text.trim(), difficulty);
      if (runRef.current !== runId) return;
      setQuiz({ status: "success", data, error: null });
    } catch (err) {
      if (runRef.current === runId) setQuiz({ status: "error", data: null, error: messageOf(err) });
    }
  }

  // Main action: sequential requests (summary first, then quiz) so the model never runs twice at once.
  async function handleGenerateAll() {
    const runId = startRun();
    if (runId === null) return;
    setQuiz({ status: "loading", data: null, error: null });
    setQuizQueued(true);
    setAnswers({});
    setSubmitted(false);
    const ok = await runSummary(runId);
    if (runRef.current !== runId) return;
    if (!ok) {
      setQuizQueued(false);
      setQuiz(emptyPanel());
      return;
    }
    await runQuiz(runId);
  }

  async function handleSummaryOnly() {
    const runId = startRun();
    if (runId === null) return;
    await runSummary(runId);
  }

  async function handleQuizOnly() {
    const runId = startRun();
    if (runId === null) return;
    await runQuiz(runId);
  }

  function handleClear() {
    runRef.current += 1; // invalidate any in-flight request
    setText("");
    setInputError(null);
    setSummary(emptyPanel());
    setQuiz(emptyPanel());
    setQuizQueued(false);
    setAnswers({});
    setSubmitted(false);
  }

  function handleSelect(questionId: string, optionIndex: number) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  function handleRetake() {
    setAnswers({});
    setSubmitted(false);
  }

  async function handleNewQuiz() {
    const runId = startRun();
    if (runId === null) return;
    await runQuiz(runId);
  }

  return (
    <div className="min-h-screen">
      <Header health={health} onRefresh={() => void refreshHealth()} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Turn study material into a summary and a quiz
          </h1>
          <p className="mt-2 text-slate-600">
            Paste notes or a chapter, pick a summary length and quiz difficulty, then test yourself. Generation uses
            Google's open-weight Gemma model through the free Gemini API.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-6">
            <InputPanel
              text={text}
              onTextChange={(v) => {
                setText(v);
                if (inputError) setInputError(null);
              }}
              inputError={inputError}
              maxChars={limits.maxInputChars}
              minChars={limits.minInputChars}
              summaryLength={summaryLength}
              onSummaryLengthChange={setSummaryLength}
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              busy={busy}
              onGenerateAll={() => void handleGenerateAll()}
              onGenerateSummary={() => void handleSummaryOnly()}
              onGenerateQuiz={() => void handleQuizOnly()}
              onLoadExample={() => {
                setText(SAMPLE_TEXT);
                setInputError(null);
              }}
              onClear={handleClear}
            />
          </div>

          <div className="space-y-6 lg:col-span-7">
            <SummaryCard panel={summary} model={modelName} />
            <QuizCard
              panel={quiz}
              model={modelName}
              queued={quizQueued}
              answers={answers}
              submitted={submitted}
              busy={busy}
              onSelect={handleSelect}
              onSubmit={() => setSubmitted(true)}
              onRetake={handleRetake}
              onNewQuiz={() => void handleNewQuiz()}
            />
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-slate-500 sm:px-6 lg:px-8">
        LearnMate AI is open source (MIT). Summaries and quizzes are generated by a language model and can contain errors.
      </footer>
    </div>
  );
}
