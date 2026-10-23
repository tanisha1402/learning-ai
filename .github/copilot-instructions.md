# Copilot instructions for LearnMate AI

Stack: React + Vite + Tailwind (client, Vercel), Express + TypeScript + Zod (server, Render), hosted Gemma via the Gemini API (`GEMMA_*` env vars). User is on Windows/PowerShell.

- Read `Project Documentation/Memory.md` first, then only the relevant files among `Architecture.md`, `Design.md`, `PRD.md`, `Phases.md`, before inspecting source code.
- Inspect and change only files relevant to the task; do not scan the entire repository.
- Update the matching `Project Documentation/` files (and `README.md` when user-facing) whenever your change affects architecture, API, config, UI, requirements, status or plans.
- Never hardcode or simulate AI responses. Do not call the real API (tests use mocked HTTP) or start generations unless asked. No generation at startup or in `/health`.
- Model output is untrusted: keep server-side validation (exactly 5 questions, 4 options each, one correct answer).
- Keep `client/src/types.ts` aligned with `server/src/types.ts`.
- The Gemma API key lives only in backend env (`GEMMA_API_KEY`). Never put it in `VITE_*`, source, docs, logs or Git. Do not commit `.env` files. Do not deploy or push without explicit permission. Prefer PowerShell commands.
- Run `npm test` and `npm run typecheck` after changes when possible and report anything you could not run.
