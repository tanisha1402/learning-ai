# Design

Documents the implemented UI. Update when components or styling change.

## 1. Direction
Clean light educational SaaS interface for a live demo. Deep indigo accent on a slate/white palette, rounded cards, subtle borders, restrained shadows. No gradients, fake statistics, or decorative clutter. Readability over flourish.

## 2. Tokens (Tailwind 3 default palette, no custom theme)
| Role | Value |
| --- | --- |
| Page background | `slate-50` |
| Surface (cards) | `white`, `border-slate-200`, `rounded-2xl`, `shadow-sm` |
| Primary text | `slate-900`; body `slate-800`; secondary `slate-500/600` |
| Accent | `indigo-600` (hover `indigo-700`), tints `indigo-50`, rings `indigo-500` |
| Success | `emerald-50/200/700` |
| Warning | `amber-50/200/600` |
| Error | `rose-50/200/600/800` |
| Font | Tailwind default sans stack (system UI fonts; no web fonts so it works offline) |
| Radii | cards `2xl`, controls/inputs `lg`-`xl`, segments `md` |

Buttons (`components/ui.ts`): `btnPrimary` (solid indigo), `btnSecondary` (white, slate border), `btnGhost` (text-only, hover slate-100). All have `focus-visible` indigo ring and a disabled style (opacity 50%, not-allowed).

## 3. Layout
- Header: white bar, bottom border. Left: indigo square logo (GraduationCap icon), "LearnMate AI", sub-label "AI-powered learning assistant". Right: status badge and a refresh icon button.
- Main: `max-w-6xl`, page intro (h1 "Turn study material into a summary and a quiz" plus one explanatory paragraph).
- Grid `lg:grid-cols-12`: input panel `col-span-5` (sticky on large screens, `top-6`), results `col-span-7` with Summary card above Quiz card. Below `lg`, everything stacks in one column (input first).
- Footer: small open-source/accuracy note.

## 4. Components
### Header health badge
Dot + label, `role="status"`. States: Checking connection... (slate), Model ready: <model> (emerald), Server has no Gemma API key (amber), Gemma API key was rejected (rose), Model not found: <model> (amber), Free-tier rate limit reached (amber), Gemma API is not reachable (rose), Backend is not reachable (rose). Refresh button re-checks (`aria-label` set).

### Input panel
- Label "Study material"; ghost buttons "Use example" and "Clear".
- Textarea (12 rows, resizable), placeholder text, rose border on error/over limit, read-only (slate-50) while generating.
- Helper line "At least N characters. Your text is sent to the Gemma API, so avoid confidential material." and live counter `current / max` (grey, amber past 90%, rose bold when over).
- Inline error area (`role="alert"`) for empty, too-short, or too-long input.
- Two segmented controls: Summary length (Short/Medium/Detailed) and Quiz difficulty (Easy/Medium/Hard). Native radios, visually hidden, with focus ring on the label.
- Buttons: full-width primary "Generate summary and quiz" (spinner and "Generating..." while busy); two secondary buttons "Summary only" and "Quiz only". All disabled while busy or over the limit.

### Summary card
- Heading "Summary"; "Copy summary" button appears on success and switches to "Copied" with a check for 2 s.
- Idle: dashed empty state ("No summary yet"). Loading: spinner, "Summarising with <model>...", "The hosted model usually answers within a few seconds.", skeleton bars. Error: rose alert "Could not generate the summary". Success: readable prose (`max-w-prose`, 15px, leading-7), `- ` lines rendered as bullet lists with indigo markers.
- Footer line: model, seconds, token count, plus "AI output can contain mistakes" reminder.

### Quiz card
- Heading "Quiz" with difficulty on the right once generated.
- Idle empty state ("No quiz yet"). Loading shows "Waiting for the summary to finish..." while queued (detail: "One request at a time keeps usage within the free-tier limits."), otherwise "Writing questions with <model>...". Error alert "Could not generate the quiz".
- Questions in an ordered list; each is a `fieldset` with a legend and four option rows (bordered labels containing a native radio, letter A-D and text). Selected option: indigo border/tint.
- "Submit quiz" is disabled until all five are answered; shows "N of 5 answered".
- After submit: radios disabled; score banner "You scored X out of 5 (Y%)" (emerald at 60%+, amber below); correct option green with check icon and "Correct answer"; wrong selection red with X icon and "Your answer"; other options muted; an explanation block ("Why: ...") under every question. Meaning never relies on colour alone (icons + text).
- Actions after submit: "Retake quiz" (same questions) and "New questions" (regenerates; disabled while busy).

## 5. States matrix
Every panel supports idle, loading, success and error. Global: backend down, Gemma API down/unconfigured/rejected key/model missing/rate-limited (header badge); input empty/short/too long (inline); server busy (error text from API).

## 6. Accessibility
Labelled textarea; `aria-describedby` for helper and error; `aria-invalid` when in error; native radio groups with fieldset/legend (arrow-key navigation works); visible focus rings; `role="status"`/`aria-live` for loading, counters and badge, `role="alert"` for errors; decorative icons `aria-hidden`; `prefers-reduced-motion` disables animation in `index.css`; contrast uses slate-600+ on white for text.

## 7. Responsive behaviour
Single column on mobile; option segmented controls stack to one column under `sm`; action buttons remain full-width; no horizontal scrolling expected at 360 px.

## 8. Do / Don't
- Do keep the indigo/slate light theme and consistent button classes from `ui.ts`.
- Do show real `meta` (model, seconds, tokens) under AI output.
- Don't add fake analytics, user stats, or hardcoded AI output; the example button only fills the input.
- Don't add heavy animation or extra font downloads.
