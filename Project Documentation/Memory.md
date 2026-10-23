# Memory

Persistent context for humans and AI assistants. Read this first. Update "Current status" and "Decisions" when they change.

## Project
LearnMate AI: paste study text -> real-model summary + exactly five multiple-choice questions -> answer -> score with explanations. Repository: https://github.com/tanisha1402/learning-ai.git. Originally built for a beginner AI hackathon.

## Owner environment and constraints
- Windows, VS Code, PowerShell. Use PowerShell syntax in docs; no bash-only workflows.
- Generation uses **hosted Gemma via the free Gemini API**. Do not reintroduce Ollama or require any local model. Do not use paid-only endpoints, and do not confuse Gemini models with Gemma (model ids must start with `gemma-`).
- **The API key lives only in the backend environment** (`server/.env` locally, Render env vars when deployed). Never in `VITE_*`, source, docs, logs or Git. Never ask the user to paste their key into chat.
- No inference at startup or in health checks. The health check is a metadata `GET models/{model}`.
- Do not deploy, push, publish secrets or make destructive Git changes without explicit permission.
- Judging priority: working app > genuine open-weight model integration > focused features > public repo with MIT license + README > realistic deployment plan > demo/architecture explanation.

## Stack (and why)
React 18, TypeScript 5.6, Vite 5, Tailwind 3.4, Axios, lucide-react; Node 20+, Express 4, Zod 3, Vitest 2, tsx. One mutually compatible set. Do not bump majors casually.

## Provider facts (researched 2026-10)
- Official Gemma-on-Gemini-API doc lists models `gemma-4-31b-it` and `gemma-4-26b-a4b-it`; endpoint `.../v1beta/models/{model}:generateContent`; supports `systemInstruction` and `thinkingConfig.thinkingLevel` (`minimal` disables, `high` enables). The page says its docs are deprecated in favour of newer docs, so ids may change.
- Free tier: active AI Studio project, no billing. Limits are per project (not per key), include RPM/TPM/RPD, RPD resets at midnight Pacific, exceeding returns 429 `RESOURCE_EXHAUSTED`. Google no longer publishes per-model figures; they appear only at https://aistudio.google.com/rate-limit.
- **Unverified (third-party only):** Gemma 4 being free-tier-only with no paid tier; free-tier content used to improve Google products; specific numbers like 15 RPM / 1,500 RPD. Do not state these as facts.
- **Unverified live (no key was available):** Gemma JSON mode, `thinkingLevel: minimal` acceptance, `models.get` for Gemma ids, actual response parts.

## Key decisions
1. Server CommonJS; client ESM. Native `fetch`; no provider SDK.
2. `ollama.ts` replaced by `gemma.ts` (`GemmaClient`); error codes renamed `OLLAMA_*` -> `AI_*`; health field `ollama` -> `provider` (`state` enum).
3. Quiz JSON is prompt-based by default (`GEMMA_JSON_MODE=false`), always Zod-validated, one repair attempt max.
4. `thinkingLevel: minimal` by default for speed; retried without it if the API rejects it.
5. Options shuffled server-side; scoring client-side (accepted trade-off).
6. Sequential generation + server lock (429 `SERVER_BUSY`) to respect free-tier limits. UI calls summary then quiz; `/learning/generate` is the single-call equivalent.
7. `GEMMA_API_KEY` optional at boot so deployments can start and report `not_configured`.
8. Production safeguards: `CORS_ORIGINS` mandatory and no `*`; `HOST` 0.0.0.0 and platform `PORT`; Render health check uses `/health/live` (never calls Google, never 503).
9. Render build installs devDependencies (`--include=dev`) because `NODE_ENV=production` would otherwise skip TypeScript.
10. Vite proxy in dev; `VITE_API_BASE_URL` (full URL incl. `/api/v1`) in production, read at build time.
11. Docs split: `README.md` for users; `Project Documentation/` for engineering.

## Current status
- Migration to hosted Gemma is implemented in code, config, tests, README, `render.yaml`, `client/vercel.json` and these docs.
- **In the offline build sandbox:** `gemma.ts`/`errors.ts` passed a strict `tsc` check and a runtime smoke test with mocked HTTP (header auth, retries, redaction, error mapping). Everything else is **unexecuted**: no `npm install`, no Vitest run, no full typecheck or build, no real Gemini API call, no deployment.
- No `package-lock.json` yet (first `npm install` creates it; commit it).
- No screenshots yet. Nothing pushed or deployed.

## Known risks / watch list
- First `npm install && npm run typecheck && npm test && npm run build` may reveal errors that could not be checked offline.
- Free quota is shared by all visitors and unpublished per model; expect 429s under load.
- Render free instances sleep when idle (cold start); first request can be slow.
- `models.get` health probe or `thinkingConfig` may behave differently for Gemma than assumed; the health badge could show a wrong state until verified with a real key.
- Gemma may be unavailable in some regions (provider returns a location error).
- Duplicated types between client and server must be kept in sync.

## Conventions
- TypeScript strict. Small modules. No new dependencies unless essential.
- Errors use `AppError` and `{ error: { code, message, details? } }`.
- Never hardcode or simulate AI output. Never log request bodies, study text or keys.
- Tests must use mocked HTTP; never call the real API in tests.

## Documentation rule
Whenever a change affects files, routes, config, behaviour, UI, scope or status, update the matching file in `Project Documentation/` (and `README.md` if user-facing) in the same change.
