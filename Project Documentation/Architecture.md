# Architecture

Source of truth for how LearnMate AI is built. Update this file whenever files, routes, config or data shapes change.

## 1. System overview

```
Browser (React 18 + Vite 5 + Tailwind 3)         Vercel (client/)
   | HTTPS  /api/v1/...   (dev: Vite proxy -> http://127.0.0.1:4000)
   v
Express 4 API (TypeScript, CommonJS)             Render (server/)
   routes -> controllers (Zod parse) -> LearningService -> GemmaClient
                         prompts.ts, parsing.ts (untrusted-output validation)
   | HTTPS, header x-goog-api-key (secret stays on the server)
   v
Gemini API (generativelanguage.googleapis.com/v1beta)  ->  hosted Gemma (default gemma-4-26b-a4b-it)
```

- npm workspaces monorepo: root, `server`, `client`. No database, auth, containers or shared package.
- Provider: Google AI Studio's Gemini API serving **Gemma 4** (`gemma-4-26b-a4b-it`, `gemma-4-31b-it`). Local Ollama is no longer used or supported.
- Client and server types are duplicated by hand (`client/src/types.ts` mirrors `server/src/types.ts`). Keep them in sync.
- No generation happens at startup or in `/health`.

## 2. Directory tree

```
learning-ai/
  AGENTS.md  LICENSE  README.md  package.json  render.yaml  .env.example  .gitignore
  .github/copilot-instructions.md
  .vscode/extensions.json
  Project Documentation/        Architecture, Design, Memory, Phases, PRD
  server/
    package.json  tsconfig.json  tsconfig.build.json  .env.example
    src/
      index.ts  app.ts  routes.ts  controllers.ts  middleware.ts
      config.ts  schemas.ts  prompts.ts  parsing.ts
      gemma.ts  learning.ts  errors.ts  types.ts
    tests/
      parsing.test.ts  schemas.test.ts  config.test.ts
      gemma.test.ts    learning.test.ts  api.test.ts
  client/
    package.json  tsconfig.json  vite.config.ts  tailwind.config.js
    postcss.config.js  index.html  vercel.json  .env.example
    src/
      main.tsx  App.tsx  index.css  types.ts
      api/client.ts
      lib/quiz.ts  quiz.test.ts  clipboard.ts  sampleText.ts
      components/
        Header.tsx  InputPanel.tsx  SegmentedControl.tsx
        SummaryCard.tsx  QuizCard.tsx
        LoadingState.tsx  EmptyState.tsx  ErrorMessage.tsx  ui.ts
```

## 3. Source-file responsibilities

### Server (`server/src`)
| File | Responsibility |
| --- | --- |
| `index.ts` | Entry. Loads `server/.env` via dotenv, `loadConfig`, wires `GemmaClient` -> `LearningService` -> `createApp`, listens on `HOST:PORT` (platform `PORT`), logs only whether a key is configured, handles SIGINT/SIGTERM. Exits with a readable message on invalid env. |
| `app.ts` | `createApp(deps)`: disables `x-powered-by`, CORS allow-list from `CORS_ORIGINS` (`*` only outside production; requests without Origin allowed), `express.json` limit `ceil(MAX_INPUT_CHARS*4/1024)+16` kB, mounts router at `/api/v1`, then `notFoundHandler`, `errorHandler`. |
| `routes.ts` | `createRouter(deps)`: `/health/live`, `/health`, and three learning endpoints. |
| `controllers.ts` | `asyncHandler`; `createLearningController` (Zod parse, call service, respond); `liveHandler`; `createHealthController` (maps provider state to message and HTTP 200/503). |
| `middleware.ts` | 404 JSON; `errorHandler`: `ZodError` -> 400 `VALIDATION_ERROR` (+`details`), `AppError` -> its status/code, body-parser errors -> 400 `INVALID_JSON` / 413, anything else -> redacted one-line log + 500 `INTERNAL_ERROR`. No stacks or env values reach the browser. |
| `config.ts` | `loadConfig(env)` (pure, tested). Zod-parses env, treats empty strings as unset, normalises URLs/origins (strips trailing `/`, strips `models/` from the model id), `HOST` defaults to `0.0.0.0` in production else `127.0.0.1`, **production requires `CORS_ORIGINS` and forbids `*`**. `GEMMA_API_KEY` is optional so the server can boot and report `not_configured`. Exports `AppConfig`, `GemmaConfig`. |
| `schemas.ts` | `buildRequestSchemas(limits)`; `quizQuestionSchema` / `quizSchema` for model output (5 questions, 4 non-empty distinct options, `correctIndex` int 0-3, explanation). |
| `prompts.ts` | Chat messages for summary, quiz and quiz-repair. User text wrapped in `<source_text>` (embedded tags stripped); the prompt tells the model to treat it as data. The quiz prompt specifies the JSON shape in words. |
| `parsing.ts` | `extractJson`, `parseQuizOutput` (normalise -> validate -> shuffle -> ids `q1..q5`), `shuffleOptions`, `cleanSummary`, `QuizParseError`. |
| `gemma.ts` | `GemmaClient` (`getStatus`, `chat`), `redactSecrets`, error mapping. `fetch` is injectable for tests. |
| `learning.ts` | `LearningService`: summary, quiz, combined; one-at-a-time lock; quiz repair; `meta`. |
| `errors.ts` | `AppError(status, code, message, details?)` and `ErrorCode`. |
| `types.ts` | Enums and payload types. |

### Client (`client/src`)
| File | Responsibility |
| --- | --- |
| `App.tsx` | All page state; input validation; sequential summary-then-quiz runs; stale-response guard (`runRef`); maps `provider.state` to the header badge (`HealthView`). |
| `api/client.ts` | Axios (`VITE_API_BASE_URL`, default `/api/v1`, 10 min timeout), `getHealth` (accepts 200 and 503), `generateSummary`, `generateQuiz`, `ApiError` + friendly error mapping. |
| `types.ts` | Mirrors server payloads incl. `HealthResponse.provider` and `ProviderState`. |
| `components/Header.tsx` | Brand, label, health badge, refresh button. |
| `components/InputPanel.tsx`, `SegmentedControl.tsx`, `SummaryCard.tsx`, `QuizCard.tsx`, `LoadingState.tsx`, `EmptyState.tsx`, `ErrorMessage.tsx`, `ui.ts` | UI (see `Design.md`). |
| `lib/quiz.ts`, `clipboard.ts`, `sampleText.ts` | Scoring helpers (tested), copy helper, example text (input only). |

## 4. Frontend architecture
- Single page, no router or store; `useState` plus a `useRef` run counter.
- `Panel<T> = { status: idle|loading|success|error, data, error }` for summary and quiz.
- Main action: validate -> quiz loading with `quizQueued` -> summary -> quiz; a failed summary skips the quiz.
- Health runs on mount and on the refresh button (no polling). It sets limits (defaults 12000/50) and the model name.
- Scoring is client-side; after submit the fieldset is disabled. The API key never reaches the client; only `VITE_API_BASE_URL` is read.

## 5. Backend request flow
1. `express.json` -> 2. Zod parse (trim, length limits, enums default `medium`) -> 3. `LearningService.exclusive` (429 `SERVER_BUSY` if busy) -> 4. prompt + `GemmaClient.chat` -> 5. clean/validate -> JSON, or `AppError` -> `errorHandler`.

## 6. API contract

Base `/api/v1`. Errors: `{ "error": { "code", "message", "details"? } }`.

- `GET /health/live` -> 200 `{ status: "ok", uptimeSeconds }` always (Render health check; never contacts Google).
- `GET /health` -> 200 when ready, else 503:
```json
{ "status": "ok|degraded",
  "app": { "status": "ok", "uptimeSeconds": 12 },
  "provider": { "name": "Google Gemini API", "model": "gemma-4-26b-a4b-it", "state": "ready" },
  "limits": { "maxInputChars": 12000, "minInputChars": 50 },
  "message": "Ready." }
```
`state`: `ready | not_configured | auth_failed | model_not_found | rate_limited | unreachable | error`.
- `POST /learning/generate-summary` `{ text, summaryLength }` -> `{ summary: { text, length, meta } }`
- `POST /learning/generate-quiz` `{ text, difficulty }` -> `{ quiz: { questions[5], difficulty, meta } }`
- `POST /learning/generate` `{ text, summaryLength, difficulty }` -> `{ summary, quiz | null, quizError | null }` (summary then quiz under one lock; quiz failure after a good summary still returns 200).
- `meta = { model, durationMs, outputTokens | null }` (sums both calls after a repair). `Question = { id, question, options[4], correctIndex, explanation }` (options shuffled).

| HTTP | code | Cause |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` | bad request |
| 404 / 413 | `NOT_FOUND` / `PAYLOAD_TOO_LARGE` | route / body size |
| 429 | `SERVER_BUSY` | a generation already running |
| 429 | `AI_RATE_LIMITED` | provider 429 (message includes retry delay when given) |
| 502 | `AI_AUTH_ERROR` | provider 401/403 or "API key not valid" (message does not echo provider text) |
| 502 | `AI_ERROR` | other provider errors / 5xx / unreadable response |
| 502 | `MODEL_EMPTY_RESPONSE` | blank summary or safety block |
| 502 | `MODEL_OUTPUT_INVALID` | quiz invalid after one repair |
| 503 | `AI_NOT_CONFIGURED` | `GEMMA_API_KEY` missing |
| 503 | `AI_UNREACHABLE` | network failure |
| 503 | `MODEL_NOT_FOUND` | provider 404 |
| 504 | `AI_TIMEOUT` | exceeded `GEMMA_TIMEOUT_MS` |
| 500 | `INTERNAL_ERROR` | unexpected (logged only) |

## 7. Gemini API / Gemma integration (`gemma.ts`)
- **Endpoint:** `POST {GEMMA_BASE_URL}/models/{model}:generateContent`. **Auth:** `x-goog-api-key` header only (never in URLs, logs or responses).
- **Body:** `systemInstruction` (system messages), `contents` (user -> `user`, assistant -> `model`), `generationConfig { temperature, maxOutputTokens, thinkingConfig.thinkingLevel?, responseMimeType? }`.
- **Response:** concatenates `candidates[0].content.parts[].text`, skipping parts with `thought: true`; `outputTokens` from `usageMetadata.candidatesTokenCount`; a `promptFeedback.blockReason` with no candidates -> `MODEL_EMPTY_RESPONSE`.
- **Compatibility retries** (max 3 attempts): HTTP 400 mentioning "thinking" -> resend without `thinkingConfig`; HTTP 400 mentioning mime/json/response while JSON mode was on -> resend without `responseMimeType`.
- **JSON for quizzes:** prompt-based by default; `GEMMA_JSON_MODE=true` adds `responseMimeType: application/json` (unverified for Gemma). Always re-validated by `quizSchema`, with at most one repair call.
- **Health probe:** `GET {base}/models/{model}` (metadata, no generation), 5 s timeout, cached 10 s. 404 -> `model_not_found`; 401/403 or 400 "api key" -> `auth_failed`; 429 -> `rate_limited`; network error -> `unreachable`; other non-OK -> `error`; no key -> `not_configured` without any network call.
- **Safe logging:** only `[gemma:kind] HTTP status providerStatus <200 redacted chars>`; `redactSecrets` strips `AIza...` patterns and the configured key. Prompts, study text and keys are never logged.
- **Unverified live:** exact free-tier quotas (Google publishes them only in the AI Studio console), Gemma support for JSON mode and `thinkingLevel: minimal`, and `models.get` for Gemma ids. See `Memory.md`.

## 8. Configuration

`server/.env` (template `server/.env.example`; on Render set the same names as environment variables):
| Variable | Default | Notes |
| --- | --- | --- |
| `GEMMA_API_KEY` | none | secret; optional at boot |
| `GEMMA_MODEL` | `gemma-4-26b-a4b-it` | or `gemma-4-31b-it` |
| `GEMMA_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` | |
| `GEMMA_TIMEOUT_MS` | 60000 | 1000-300000 |
| `GEMMA_TEMPERATURE` | 0.3 | |
| `GEMMA_MAX_OUTPUT_TOKENS_SUMMARY` | 1500 | further capped 400/800/1400 by length |
| `GEMMA_MAX_OUTPUT_TOKENS_QUIZ` | 3000 | |
| `GEMMA_THINKING_LEVEL` | `minimal` | `off` omits |
| `GEMMA_JSON_MODE` | false | |
| `NODE_ENV` | development | `production` on Render |
| `PORT` | 4000 | platform-provided in production |
| `HOST` | 127.0.0.1 / 0.0.0.0 (production) | |
| `CORS_ORIGINS` | dev origins | mandatory in production, no `*` |
| `MAX_INPUT_CHARS` / `MIN_INPUT_CHARS` | 12000 / 50 | |

`client/.env`: `VITE_API_BASE_URL` (default `/api/v1`; deployed = full backend URL incl. `/api/v1`), `VITE_DEV_PROXY_TARGET`. `VITE_*` is public: never place the key there.

Removed in the Gemma migration: `OLLAMA_*` variables, `ollama.ts`, local-model assumptions.

## 9. Scripts
Root: `dev` (concurrently), `dev:server`, `dev:client`, `build`, `start` (`npm run start -w server`), `test`, `typecheck`. Server: `dev` tsx watch, `build` `tsc -p tsconfig.build.json`, `start` `node dist/index.js`. Client: `dev` Vite (127.0.0.1:5173), `build` `tsc --noEmit && vite build`.

## 10. Testing (Vitest 2; mocked HTTP; no key, network or quota needed)
- `gemma.test.ts`: request shape, header auth (key not in URL), thought-part filtering, health states, error mapping, retries without `thinkingConfig` / JSON mode, key redaction.
- `api.test.ts`: real Express app on an ephemeral port with fake provider/service: health 200/503 states, `/health/live`, response shapes, validation, invalid JSON, error pass-through, hidden internal errors, 404, CORS allow/deny.
- `config.test.ts`: defaults, overrides, normalisation, production rules (PORT/HOST, mandatory CORS, no wildcard).
- `learning.test.ts`, `parsing.test.ts`, `schemas.test.ts`, client `lib/quiz.test.ts`.
- Not covered: React components and any real call to Google.

## 11. Deployment
- **Backend on Render** via `render.yaml`: build `npm install --include=dev && npm run build -w server`, start `npm run start -w server`, health check `/api/v1/health/live`, env `NODE_ENV=production`, `NODE_VERSION=20`, secrets `GEMMA_API_KEY` and `CORS_ORIGINS` set in the dashboard.
- **Frontend on Vercel:** root directory `client`, Vite preset, `VITE_API_BASE_URL=https://<render-host>/api/v1`, redeploy after changing it.
- Then set `CORS_ORIGINS` on Render to the exact Vercel origin. Free Render services sleep when idle; all visitors share one free Gemma quota; no per-user rate limiting or auth exists.
