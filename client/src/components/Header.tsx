import { GraduationCap, RefreshCw } from "lucide-react";
import { btnGhost } from "./ui";

export type HealthView =
  | { kind: "checking" }
  | { kind: "ready"; model: string }
  | { kind: "not-configured" }
  | { kind: "auth-failed" }
  | { kind: "model-missing"; model: string }
  | { kind: "rate-limited" }
  | { kind: "provider-down" }
  | { kind: "backend-down" };

function describe(health: HealthView): { label: string; dot: string; text: string } {
  switch (health.kind) {
    case "checking":
      return { label: "Checking connection…", dot: "bg-slate-400", text: "text-slate-600" };
    case "ready":
      return { label: `Model ready: ${health.model}`, dot: "bg-emerald-500", text: "text-emerald-800" };
    case "not-configured":
      return { label: "Server has no Gemma API key", dot: "bg-amber-500", text: "text-amber-800" };
    case "auth-failed":
      return { label: "Gemma API key was rejected", dot: "bg-rose-500", text: "text-rose-800" };
    case "model-missing":
      return { label: `Model not found: ${health.model}`, dot: "bg-amber-500", text: "text-amber-800" };
    case "rate-limited":
      return { label: "Free-tier rate limit reached", dot: "bg-amber-500", text: "text-amber-800" };
    case "provider-down":
      return { label: "Gemma API is not reachable", dot: "bg-rose-500", text: "text-rose-800" };
    case "backend-down":
      return { label: "Backend is not reachable", dot: "bg-rose-500", text: "text-rose-800" };
  }
}

export function Header({ health, onRefresh }: { health: HealthView; onRefresh: () => void }) {
  const view = describe(health);
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold text-slate-900">LearnMate AI</p>
            <p className="text-xs text-slate-500">AI-powered learning assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <p className={`flex items-center gap-2 text-sm font-medium ${view.text}`} role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${view.dot}`} aria-hidden="true" />
            {view.label}
          </p>
          <button
            type="button"
            onClick={onRefresh}
            className={btnGhost}
            aria-label="Re-check backend and Gemma API status"
            title="Re-check status"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
