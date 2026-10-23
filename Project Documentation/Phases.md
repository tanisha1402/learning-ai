# Phases

Actionable implementation plan with a progress checklist. Tick items as they are verified, not just written. "Written" means the code exists; "Verified" means it ran on the owner's machine.

## Phase 0: Scaffold and configuration
- [x] npm workspaces monorepo (root, `server`, `client`), root scripts (`dev`, `build`, `test`, `typecheck`, `start`)
- [x] `.gitignore`, MIT `LICENSE`, root/server/client `.env.example`
- [x] TypeScript, Vite, Tailwind, PostCSS configs
- [ ] **Verify:** `npm install` succeeds; commit the generated `package-lock.json`

## Phase 1: Backend foundation
- [x] Env config with Zod (`config.ts`) and `AppError` / error middleware
- [x] Request schemas with configurable limits (`schemas.ts`)
- [x] `GET /api/v1/health` (no inference)
- [x] CORS allow-list, body-size limit, graceful shutdown
- [ ] **Verify:** `Invoke-RestMethod http://127.0.0.1:4000/api/v1/health` returns `status: ok` and `provider.state: ready`

## Phase 2: Hosted Gemma integration and generation
- [x] `GemmaClient` (`getStatus`, `chat`, error mapping, `thinkingConfig`/JSON-mode fallbacks, key redaction)
- [x] Prompts with delimited untrusted text; quiz JSON shape described in the prompt
- [x] Summary endpoint with three lengths
- [x] Quiz endpoint with validation, shuffling, single repair attempt
- [x] Combined endpoint (sequential) and one-at-a-time lock
- [ ] **Verify:** real summary returned by the Gemma API with your key (check `meta.model`)
- [ ] **Verify:** real quiz passes validation (5 x 4, one correct)

## Phase 3: Frontend core
- [x] API client with friendly errors; health badge
- [x] Input panel (counter, example, clear, options)
- [x] Summary card with copy button and all four states
- [x] Quiz card with submit, score, marking, explanations, retake / new questions
- [x] Sequential "Generate summary and quiz" flow with stale-response guard
- [ ] **Verify:** full flow in the browser on the example text

## Phase 4: Tests and static checks
- [x] Server tests written (parsing, schemas, config, gemma client, learning, HTTP-level API tests), all with mocked HTTP
- [x] Client unit tests written (quiz scoring)
- [ ] **Verify:** `npm test` passes
- [ ] **Verify:** `npm run typecheck` and `npm run build` pass
- [ ] Fix any issues found, then update `Memory.md` status

## Phase 5: Demo hardening (owner's machine)
- [ ] Run one summary and one quiz with realistic text; note timings and whether `thinkingLevel: minimal` and `GEMMA_JSON_MODE` work in `Memory.md`
- [ ] Try `gemma-4-31b-it` vs `gemma-4-26b-a4b-it` for quiz quality/latency; keep the better one
- [ ] Rehearse the demo script in `README.md` (include showing the error state with a wrong key)
- [ ] Capture screenshots into `docs/` and link them in `README.md`
- [ ] Prepare answers for the technical-decisions list

## Phase 6: Repository and submission
- [ ] `git init`, first commit including `package-lock.json`, confirm no `.env` is tracked
- [ ] Push to a public GitHub repo (license visible as MIT)
- [ ] Final README pass (screenshots, repo URL)

## Phase 7: Public deployment (Render + Vercel)
- [x] `render.yaml`, `client/vercel.json`, production config rules (PORT/HOST, mandatory CORS), `/health/live`
- [ ] Obtain a free key at https://aistudio.google.com/apikey
- [ ] Deploy the backend on Render (`GEMMA_API_KEY`, placeholder `CORS_ORIGINS`); verify `/api/v1/health`
- [ ] Deploy the frontend on Vercel with `VITE_API_BASE_URL=https://<render-host>/api/v1`
- [ ] Set `CORS_ORIGINS` on Render to the exact Vercel origin
- [ ] Add rate limiting/auth if sharing widely

## Phase 8: Hosted-Gemma migration (done in code, unverified live)
- [x] Research provider (Gemini API serving Gemma 4), document verified vs unverified facts
- [x] Replace `ollama.ts` with `gemma.ts`; rename config, errors, health shape; update client badge and copy
- [x] Update tests, README, env examples, docs
- [ ] **Verify:** `npm install`, `npm test`, `npm run typecheck`, `npm run build`
- [ ] **Verify:** one real summary + quiz with your key

## Deferred / out of scope
Streaming responses, accounts, history/persistence, file upload/OCR, multiple models, analytics, Docker.

## Change protocol
1. Read `Memory.md` and the relevant docs. 2. Change only the files needed. 3. Run `npm test` and `npm run typecheck`. 4. Update `Architecture.md`, `Design.md`, `PRD.md`, `Phases.md`, `Memory.md` as affected.
