# AGENTS.md

LearnMate AI: React/Vite client (Vercel) + Express/TypeScript server (Render) calling Google's hosted Gemma model through the free Gemini API. Windows + PowerShell user.

## Before you touch code
1. Read `Project Documentation/Memory.md` first (constraints, decisions, status).
2. Then read only what the task needs: `Architecture.md` (files, API, config, Gemma API integration), `Design.md` (UI), `PRD.md` (requirements, acceptance), `Phases.md` (plan, checklist).
3. Only then open the specific source files named in those docs. Do not scan or read the whole repo.

## Rules
- Inspect and edit only files relevant to the task. Keep changes minimal; add no dependencies unless essential.
- Never hardcode or simulate AI output. Never run real API generations unless the user asks; tests must use mocked HTTP. No generation at startup or in health checks.
- Treat model output as untrusted; keep quiz validation (5 questions x 4 options, one correct answer).
- Keep client `src/types.ts` in sync with `server/src/types.ts` and API shapes in `Architecture.md`.
- The Gemma API key lives only in backend env (`GEMMA_API_KEY`). Never put it in `VITE_*`, source, docs, logs or Git, and never ask the user to paste it. Never commit `.env` files. Use PowerShell syntax in instructions.
- Do not deploy, push, or change Git history without explicit permission.
- Run `npm test` and `npm run typecheck` after code changes when possible; say plainly what was not run.

## Update docs with the code
If a change affects files, routes, config, behaviour, UI, scope or status, update the matching `Project Documentation/` file (and `README.md` if user-facing) in the same change. Tick or add items in `Phases.md` and refresh "Current status" in `Memory.md`.
