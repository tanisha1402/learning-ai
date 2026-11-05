# Design

Documents the implemented UI. Update when components or styling change.

## 1. Direction
Light educational interface for a live demo, themed on the AIgnite Buildathon 2026 sticker: deep purple ink, violet and a single coral accent on a lavender-tinted off-white page. Heavy display type for headings, large rounded cards, soft purple-tinted shadows. No gradients, fake statistics, or decorative clutter. Readability over flourish.

## 2. Tokens (custom colours and fonts in `client/tailwind.config.js`; sampled from the sticker)
| Role | Value |
| --- | --- |
| Page background | `mist` `#f7f4fb` |
| Surface (cards) | `white`, `border-line` (`#e4dcee`), `rounded-3xl`, soft purple-tinted shadow |
| Primary text / ink | `ink` `#2c144e` (hover `#3f1d70`); secondary text `muted` `#5f5675` |
| Accent (interactive) | `violet` `#6b3184` (borders, focus ring, ghost buttons), tint `lilac` `#f0e9f7` |
| Highlight | `coral` `#fe714f` (bullet markers, progress bar, icon accents on dark). Never used for text on white; `coral-deep` `#c2410c` if ever needed |
| Success | `emerald-50/200/700` |
| Warning | `amber-50/200/700` |
| Error | `rose-50/200/600/800` |
| Font | System stacks only (no web fonts, works offline): `font-sans` = Segoe UI Variable Text / system-ui; `font-display` = Segoe UI Variable Display / system-ui, used at weight 700-800 for headings |
| Radii | cards `3xl`, inputs/options `xl`-`2xl`, buttons `xl`, segments `lg` |

Buttons (`components/ui.ts`): `btnPrimary` (solid ink purple, coral sparkle icon), `btnSecondary` (white, violet border), `btnGhost` (violet text, hover lilac). All have `focus-visible` violet ring and a disabled style (opacity 50%, not-allowed).

## 3. Layout
- Header: white bar, bottom border. Left: ink-purple rounded logo (GraduationCap icon, small coral dot), "LearnMate AI", sub-label "AI-powered learning assistant". Right: status pill (tinted per state) and a refresh icon button.
- Main: `max-w-6xl`. Hero is a 12-column grid: left h1 "Turn study material into a summary and a quiz" (`font-display`, 4xl/5xl, weight 800) plus one paragraph; right the Buildathon sticker (`client/public/buildathon-sticker.webp`, resized from the supplied PNG, with `mix-blend-multiply` so its white background blends into the page). Below `lg` the sticker stacks under the text.
- Grid `lg:grid-cols-12`: input panel `col-span-5` (sticky on large screens, `top-6`), results `col-span-7` with Summary card above Quiz card. Below `lg`, everything stacks in one column (input first).
- Footer: small open-source/accuracy note.

## 4. Components
### Header health badge
Tinted pill with dot + label, `role="status"`. States: Checking connection... (slate), Model ready: <model> (emerald), Server has no Gemma API key (amber), Gemma API key was rejected (rose), Model not found: <model> (amber), Free-tier rate limit reached (amber), Gemma API is not reachable (rose), Backend is not reachable (rose). Refresh button re-checks (`aria-label` set).

### Input panel
- Label "Study material"; ghost buttons "Use example" and "Clear".
- Textarea (12 rows, resizable, mist background that turns white on focus), placeholder text, rose border on error/over limit, read-only (lilac tint) while generating.
- Helper line "At least N characters. Your text is sent to the Gemma API, so avoid confidential material." and live counter `current / max` (grey, amber past 90%, rose bold when over).
- Inline error area (`role="alert"`) for empty, too-short, or too-long input.
- Two segmented controls: Summary length (Short/Medium/Detailed) and Quiz difficulty (Easy/Medium/Hard). Native radios, visually hidden, with focus ring on the label. Selected segment is solid ink purple with white text.
- Buttons: full-width primary "Generate summary and quiz" (spinner and "Generating..." while busy); two secondary buttons "Summary only" and "Quiz only". All disabled while busy or over the limit.

### Summary card
- Heading "Summary"; "Copy summary" button appears on success and switches to "Copied" with a check for 2 s.
- Idle: dashed empty state ("No summary yet"). Loading: spinner, "Summarising with <model>...", "The hosted model usually answers within a few seconds.", skeleton bars. Error: rose alert "Could not generate the summary". Success: readable prose (`max-w-prose`, 15px, leading-7), `- ` lines rendered as bullet lists with coral markers. Card headings carry a lilac icon chip.
- Footer line: model, seconds, token count, plus "AI output can contain mistakes" reminder.

### Quiz card
- Heading "Quiz" (lilac icon chip) with the difficulty as a lilac pill on the right once generated.
- Idle empty state ("No quiz yet"). Loading shows "Waiting for the summary to finish..." while queued (detail: "One request at a time keeps usage within the free-tier limits."), otherwise "Writing questions with <model>...". Error alert "Could not generate the quiz".
- Questions in an ordered list; each is a `fieldset` with a legend and four option rows (bordered labels containing a visually hidden native radio, a letter badge A-D and text). Selected option: violet border, lilac tint, ink letter badge.
- "Submit quiz" is disabled until all five are answered; shows "N of 5 answered" with a small coral progress bar.
- After submit: radios disabled; score banner with a large X/5 badge and "You scored X out of 5 (Y%)" (emerald at 60%+, amber below); correct option green with check icon and "Correct answer"; wrong selection red with X icon and "Your answer"; other options muted; an explanation block ("Why: ...", lilac with a violet left border) under every question. Meaning never relies on colour alone (icons + text).
- Actions after submit: "Retake quiz" (same questions) and "New questions" (regenerates; disabled while busy).

## 5. States matrix
Every panel supports idle, loading, success and error. Global: backend down, Gemma API down/unconfigured/rejected key/model missing/rate-limited (header badge); input empty/short/too long (inline); server busy (error text from API).

## 6. Accessibility
Labelled textarea; `aria-describedby` for helper and error; `aria-invalid` when in error; native radio groups with fieldset/legend (arrow-key navigation works); visible focus rings; `role="status"`/`aria-live` for loading, counters and badge, `role="alert"` for errors; decorative icons `aria-hidden`; `prefers-reduced-motion` disables animation in `index.css`; text is `ink` or `muted` (both above 4.5:1 on white and on `mist`); coral is never used for text.

## 7. Responsive behaviour
Single column on mobile; option segmented controls stack to one column under `sm`; action buttons remain full-width; no horizontal scrolling expected at 360 px.

## 8. Do / Don't
- Do keep the ink/violet/coral light theme and consistent button classes from `ui.ts`.
- Do show real `meta` (model, seconds, tokens) under AI output.
- Don't add fake analytics, user stats, or hardcoded AI output; the example button only fills the input.
- Don't add heavy animation or extra font downloads.
- Don't use the sticker on a dark or coloured background: it is a raster with a white backdrop and relies on `mix-blend-multiply` over the light page.
