// Shared Tailwind class strings so buttons look consistent everywhere.
const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-white";

export const btnPrimary =
  `inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 ${focus}`;

export const btnSecondary =
  `inline-flex items-center justify-center gap-2 rounded-xl border border-violet/30 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink transition hover:border-violet hover:bg-lilac disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

export const btnGhost =
  `inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-violet transition hover:bg-lilac hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

export const card = "rounded-3xl border border-line bg-white shadow-[0_1px_2px_rgba(44,20,78,0.05),0_8px_24px_-12px_rgba(44,20,78,0.12)]";
