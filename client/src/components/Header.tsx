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

function describe(health: HealthView): { label: string; dot: string; text: string; pill: string } {
  switch (health.kind) {
    case "checking":
      return { label: "Checking connection…", dot: "bg-slate-400", text: "text-slate-700", pill: "border-slate-200 bg-slate-50" };
    case "ready":
      return { label: `Model ready: ${health.model}`, dot: "bg-emerald-500", text: "text-emerald-800", pill: "border-emerald-200 bg-emerald-50" };
    case "not-configured":
      return { label: "Server has no Gemma API key", dot: "bg-amber-500", text: "text-amber-800", pill: "border-amber-200 bg-amber-50" };
    case "auth-failed":
      return { label: "Gemma API key was rejected", dot: "bg-rose-500", text: "text-rose-800", pill: "border-rose-200 bg-rose-50" };
    case "model-missing":
      return { label: `Model not found: ${health.model}`, dot: "bg-amber-500", text: "text-amber-800", pill: "border-amber-200 bg-amber-50" };
    case "rate-limited":
      return { label: "Free-tier rate limit reached", dot: "bg-amber-500", text: "text-amber-800", pill: "border-amber-200 bg-amber-50" };
    case "provider-down":
      return { label: "Gemma API is not reachable", dot: "bg-rose-500", text: "text-rose-800", pill: "border-rose-200 bg-rose-50" };
    case "backend-down":
      return { label: "Backend is not reachable", dot: "bg-rose-500", text: "text-rose-800", pill: "border-rose-200 bg-rose-50" };
  }
}

export function Header({ health, onRefresh }: { health: HealthView; onRefresh: () => void }) {
  const view = describe(health);
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-coral" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-extrabold tracking-tight text-ink">LearnMate AI</p>
            <p className="text-xs text-muted">AI-powered learning assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <p className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${view.pill} ${view.text}`} role="status" aria-live="polite">
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
