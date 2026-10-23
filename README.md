# LearnMate AI

An AI-powered learning assistant. Paste study material, get an accurate summary and a five-question multiple-choice quiz, answer the quiz, and see your score with explanations.

All AI output comes from **Google's open-weight Gemma model, hosted by the free Gemini API** (default model `gemma-4-26b-a4b-it`). Nothing is installed or run locally except the app itself, and there are no canned or simulated responses.

> **Screenshots:** _add `docs/screenshot-summary.png` and `docs/screenshot-quiz.png` here before submitting._

## Provider and model

| | |
| --- | --- |
| Provider | Google AI Studio / Gemini API (`generativelanguage.googleapis.com`) hosting Gemma |
| Default model | `gemma-4-26b-a4b-it` (Gemma 4 26B A4B, mixture-of-experts, faster) |
| Alternative | `gemma-4-31b-it` (Gemma 4 31B dense, higher quality, slower). Set with `GEMMA_MODEL`. |
| Endpoint | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| Auth | API key in the `x-goog-api-key` request header, sent only by the backend |

Official documentation:
- Gemma on the Gemini API (models, request format, system instructions, thinking): https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api
- Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
- Get an API key: https://aistudio.google.com/apikey

This is the Gemini API serving **Gemma** models. It is not a Gemini model; the model id must start with `gemma-`.

### Free-tier facts and limits

What Google's documentation states:
- The free tier needs only an active AI Studio project. No billing account is required.
- Limits are applied **per project, not per API key**, so extra keys in the same project do not add quota.
- Each limit type (requests per minute, tokens per minute, requests per day) can trigger an error. Daily limits reset at midnight Pacific time. Exceeding a limit returns `429 RESOURCE_EXHAUSTED`.
- Google no longer publishes a per-model limit table. **Your exact Gemma limits are shown only in your own AI Studio rate-limit page** (https://aistudio.google.com/rate-limit). Google also states that limits are not guaranteed.

What I could **not** confirm from Google's own pages (verify before relying on it):
- Third-party sources report Gemma 4 on the Gemini API as free-tier only, with no paid tier. I could not open Google's pricing page directly to confirm.
- Third-party sources say free-tier content may be used to improve Google products. **Do not submit private or confidential text.** The UI warns about this.
- Blog posts quote figures such as "15 requests/minute and 1,500 requests/day". These are unofficial and may be wrong or outdated.
- Google's Gemma docs page notes that it is deprecated in favour of newer documentation, so model ids can change. If you get a "model not found" message, check your AI Studio model list.

How the app uses the quota: one summary is 1 request, one quiz is 1 request (up to 2 if a repair is needed), and "Generate summary and quiz" is 2 to 3. The server also runs only one generation at a time.

## Features

- Summary generator with short / medium / detailed lengths, a copy button, and loading, success, empty-input and error states
- Quiz generator: exactly 5 questions, 4 options each, one correct answer, a short explanation, Easy / Medium / Hard difficulty
- Server-side validation of every quiz (model output is treated as untrusted data) with one controlled repair attempt if the JSON is invalid
- Quiz answers lock after submission; "Retake quiz" or "New questions" starts over
- Combined mode: one button generates the summary, then the quiz (sequential)
- Character counter, configurable input limit (default 12,000), clear button, "Use example" button (fills the input only)
- Status badge showing whether the backend, API key and model are working (a metadata check, no text generation)
- Accessible labels, native radio groups, visible focus, responsive layout

## Architecture

```
Browser (React + Vite + Tailwind)            deployed on Vercel
   |  HTTPS  VITE_API_BASE_URL  ->  /api/v1/...
   v
Express API (TypeScript)                     deployed on Render
   routes -> controllers (Zod validation) -> LearningService -> GemmaClient
                                   prompts.ts   parsing.ts (untrusted-output validation)
   |  HTTPS, x-goog-api-key header (key lives only here)
   v
Gemini API  ->  Gemma (gemma-4-26b-a4b-it)
```

```
learning-ai/
  Project Documentation/  Architecture, Design, Memory, Phases, PRD (read these first)
  AGENTS.md               instructions for AI coding assistants
  .github/copilot-instructions.md
  render.yaml             Render blueprint for the backend
  package.json            npm workspaces + root scripts
  client/                 React app (Vite, Tailwind, Axios, lucide-react); vercel.json
    src/api/client.ts     API calls (base URL from VITE_API_BASE_URL)
    src/lib/quiz.ts       quiz scoring helpers (unit tested)
    src/components/       UI components
  server/
    src/config.ts         env parsing/validation (Zod)
    src/schemas.ts        request schemas + quiz schema (5 questions x 4 options)
    src/prompts.ts        prompt construction
    src/parsing.ts        JSON extraction, validation, option shuffling
    src/gemma.ts          Gemini API client (Gemma) + error mapping + health probe
    src/learning.ts       generation workflow (repair attempt, one-at-a-time lock)
    src/controllers.ts, routes.ts, middleware.ts, app.ts, index.ts
    tests/                Vitest unit and HTTP-level tests (mocked HTTP, no API key needed)
```

## Configuration

### Backend (`server/.env` locally, Render environment variables when deployed)

| Variable | Default | Notes |
| --- | --- | --- |
| `GEMMA_API_KEY` | none | **Secret.** From https://aistudio.google.com/apikey. If empty the server still starts and `/health` reports `not_configured`. |
| `GEMMA_MODEL` | `gemma-4-26b-a4b-it` | or `gemma-4-31b-it` |
| `GEMMA_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` | |
| `GEMMA_TIMEOUT_MS` | 60000 | per request |
| `GEMMA_TEMPERATURE` | 0.3 | |
| `GEMMA_MAX_OUTPUT_TOKENS_SUMMARY` | 1500 | includes thinking tokens; also capped by length (400/800/1400) |
| `GEMMA_MAX_OUTPUT_TOKENS_QUIZ` | 3000 | |
| `GEMMA_THINKING_LEVEL` | `minimal` | sent as `thinkingConfig.thinkingLevel`; `off` omits it. If the API rejects it, the server retries without it. |
| `GEMMA_JSON_MODE` | `false` | send `responseMimeType: application/json` for quizzes. Unverified for Gemma, so off by default. |
| `NODE_ENV` | `development` | set `production` on Render |
| `PORT` | 4000 | Render provides this automatically |
| `HOST` | `127.0.0.1` dev, `0.0.0.0` production | |
| `CORS_ORIGINS` | dev origins | **Required in production**, exact origins, no `*` |
| `MAX_INPUT_CHARS` / `MIN_INPUT_CHARS` | 12000 / 50 | |

### Frontend (`client/.env` locally, Vercel environment variables when deployed)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api/v1` | Deployed: full backend URL **including** `/api/v1`, e.g. `https://learnmate-api.onrender.com/api/v1` |
| `VITE_DEV_PROXY_TARGET` | `http://127.0.0.1:4000` | local dev proxy only |

> **Never** put the Gemma API key in `client/.env` or any `VITE_*` variable. Those values are public in the browser bundle. `.env` files are git-ignored.

## Run locally (Windows + VS Code, PowerShell)

1. **Prerequisites:** `node --version` (v18.18 or newer, v20/v22 recommended), `npm --version`, `git --version`.
2. **Get a free key:** open https://aistudio.google.com/apikey, sign in with a Google account, choose **Create API key**, and copy it. Do not paste it into chat, code or Git.
3. **Open the folder** in VS Code (File > Open Folder), then open a terminal.
4. **Install:**
   ```powershell
   npm install
   ```
5. **Create env files:**
   ```powershell
   Copy-Item server\.env.example server\.env
   Copy-Item client\.env.example client\.env
   ```
   Edit `server\.env` and set `GEMMA_API_KEY=` to your key.
6. **Start both apps:**
   ```powershell
   npm run dev
   ```
   Open http://127.0.0.1:5173. The header badge should read "Model ready: gemma-4-26b-a4b-it".
7. **Check health:**
   ```powershell
   Invoke-RestMethod http://127.0.0.1:4000/api/v1/health
   ```
8. **Test real generation** from the UI (click "Use example", then "Generate summary and quiz"), or:
   ```powershell
   $body = @{ text = "Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose. It takes place in chloroplasts and releases oxygen."; summaryLength = "short" } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4000/api/v1/learning/generate-summary -ContentType "application/json" -Body $body
   ```
9. **Stop:** press `Ctrl + C` in the terminal.

### Tests, type checks and builds

```powershell
npm test            # server + client unit tests (mocked HTTP, no key, no quota used)
npm run typecheck   # TypeScript, both workspaces
npm run build       # compiles server/dist and client/dist
```

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `npm.ps1 cannot be loaded because running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, reopen the terminal |
| Badge: **Server has no Gemma API key** | Set `GEMMA_API_KEY` in `server\.env` (or Render), restart the backend |
| Badge: **Gemma API key was rejected** | Re-create the key in AI Studio and update `GEMMA_API_KEY` |
| Badge: **Model not found** | Check `GEMMA_MODEL` against the model list in AI Studio |
| Badge: **Free-tier rate limit reached** / error 429 | Wait a minute (daily quota resets midnight Pacific). Check https://aistudio.google.com/rate-limit |
| Badge: **Gemma API is not reachable** | Check your internet connection, proxy or firewall |
| Provider says the location is not supported | The Gemini API is not available in every region. See Google's "available regions" documentation |
| Backend not reachable | Make sure `npm run dev` is running and read the terminal for env errors |
| `EADDRINUSE` | `netstat -ano \| findstr :4000`, then `taskkill /PID <pid> /F`, or change `PORT` |
| "model did not return a valid quiz" | Click generate again; try Easy difficulty or shorter text |
| Browser CORS error | Add the frontend origin to `CORS_ORIGINS` and restart the backend |

## API

Base path `/api/v1`. Errors always look like `{ "error": { "code", "message", "details"? } }`.

| Method | Path | Body | Success response |
| --- | --- | --- | --- |
| GET | `/health/live` | none | 200 `{ status: "ok" }` while the process is up (used by Render; never calls Google) |
| GET | `/health` | none | 200 `ok` or 503 `degraded`: `{ status, app, provider: { name, model, state }, limits, message }` |
| POST | `/learning/generate-summary` | `{ text, summaryLength: "short" \| "medium" \| "detailed" }` | `{ summary: { text, length, meta } }` |
| POST | `/learning/generate-quiz` | `{ text, difficulty: "easy" \| "medium" \| "hard" }` | `{ quiz: { questions[5], difficulty, meta } }` |
| POST | `/learning/generate` | `{ text, summaryLength, difficulty }` | `{ summary, quiz \| null, quizError \| null }` |

`provider.state` is one of `ready`, `not_configured`, `auth_failed`, `model_not_found`, `rate_limited`, `unreachable`, `error`. The health check calls `GET models/{model}` (metadata only) and is cached for 10 seconds.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` | bad request |
| 413 | `PAYLOAD_TOO_LARGE` | body too large |
| 429 | `SERVER_BUSY` | another generation is running |
| 429 | `AI_RATE_LIMITED` | free-tier quota or rate limit reached |
| 502 | `AI_AUTH_ERROR` | Google rejected the server's key |
| 502 | `AI_ERROR`, `MODEL_EMPTY_RESPONSE`, `MODEL_OUTPUT_INVALID` | provider error, blocked/empty output, or invalid quiz after one repair |
| 503 | `AI_NOT_CONFIGURED`, `AI_UNREACHABLE`, `MODEL_NOT_FOUND` | no key, network failure, unknown model |
| 504 | `AI_TIMEOUT` | exceeded `GEMMA_TIMEOUT_MS` |
| 500 | `INTERNAL_ERROR` | unexpected (details logged server-side only) |

The web app calls summary then quiz as two sequential requests so the summary appears as soon as it is ready.

## Deployment: backend on Render, frontend on Vercel

Repository: https://github.com/tanisha1402/learning-ai.git. Nothing is deployed or pushed automatically.

### 0. Push the code (when you are ready)
```powershell
git status                      # confirm no .env files are listed
git add .
git commit -m "Switch to hosted Gemma API and add deployment config"
git push
```
Commit `package-lock.json` after your first `npm install`.

### 1. Backend on Render
1. In Render choose **New > Blueprint**, connect the GitHub repo, and let it read `render.yaml`. (Or **New > Web Service** and enter the same values manually.)
2. Settings used by the blueprint: root directory = repository root; build command `npm install --include=dev && npm run build -w server`; start command `npm run start -w server`; health check path `/api/v1/health/live`; `NODE_ENV=production`; `NODE_VERSION=20`.
3. When prompted for secrets, set `GEMMA_API_KEY` to your key. For `CORS_ORIGINS` enter a placeholder for now such as `https://example.vercel.app`.
4. Deploy. Render supplies `PORT`; the server binds `0.0.0.0` in production.
5. Open `https://<your-service>.onrender.com/api/v1/health` and confirm `"state": "ready"`.

### 2. Frontend on Vercel
1. In Vercel choose **Add New > Project**, import the same repo.
2. Set **Root Directory** to `client` (framework preset: Vite; build `npm run build`; output `dist`; `client/vercel.json` already says so).
3. Add the environment variable `VITE_API_BASE_URL` = `https://<your-service>.onrender.com/api/v1` (include `/api/v1`, no trailing slash).
4. Deploy and note the production URL, for example `https://learning-ai.vercel.app`.
5. If you change `VITE_API_BASE_URL` later, redeploy: Vite reads it at build time.

### 3. Connect them (CORS)
In Render, set `CORS_ORIGINS` to the exact Vercel production URL (for example `https://learning-ai.vercel.app`) and save so the service restarts. Wildcards are rejected in production, and each Vercel preview URL is a different origin, so list any others separated by commas.

### Deployment limitations
- Render's free web service sleeps after a period of inactivity, so the first request after idling can take a while. Wake it before demos by opening `/api/v1/health/live`. (Check Render's current free-plan terms.)
- All visitors share one free-tier Gemma quota (per project). A busy public demo can hit `429` errors. There is no per-user rate limiting or authentication; add them before sharing widely.
- Long generations plus a cold start can be slow. Keep input short for live demos.

## Limitations

- Summaries and quizzes are model output and can be wrong. The app validates structure, not facts, and says so in the UI.
- Free-tier quotas are unpublished per model and can change; text may be used by Google to improve its products on the free tier (unconfirmed).
- Quiz answers are sent to the browser, so a determined user could read them. Scoring is client-side by design.
- Live behaviour of the Gemma API (JSON mode, thinking settings, health probe) has not been exercised with a real key in this repository's test setup. Unit tests use mocked HTTP.
- Text only: no PDF upload. No accounts, history or persistence.

## Demo script (about 3 minutes)

1. **Readiness (20s).** Point at the header badge ("Model ready: gemma-4-26b-a4b-it"). Explain that the backend calls Google's hosted Gemma through the free Gemini API and keeps the key server-side.
2. **Paste (15s).** Click **Use example** or paste your own notes. Mention the counter and limit.
3. **Generate (40s).** Choose Medium/Medium and click **Generate summary and quiz**. The summary appears first, then the quiz.
4. **Show it is real (20s).** Point at the footer under each result: model name, seconds and token count. Paste different text to show different output.
5. **Quiz (40s).** Answer all five (miss one), submit, show the score, green/red marking and explanations, then **Retake quiz**.
6. **Architecture (30s).** React on Vercel, Express on Render, Zod validation, validation and one repair attempt for untrusted model output, key never in the browser.

## Technical decisions to explain to judges

- **Hosted Gemma instead of local inference** so the app works for anyone with a link and needs no local GPU or install. The trade-off is a shared free quota and a dependency on one provider.
- **Backend proxy.** The browser never sees the key; the backend adds `x-goog-api-key` and enforces input limits and CORS.
- **Untrusted output.** Quiz JSON is extracted and validated with Zod (5 questions x 4 distinct options, one `correctIndex` 0-3, explanation). One repair attempt at most.
- **Prompt-based JSON** by default because JSON mode support for Gemma is unverified; an optional switch exists.
- **Sequential requests plus a server lock** keep free-tier usage predictable.
- **Health check is metadata-only** and cached, so it does not spend generation quota.
- **Safe logging.** Provider errors are logged as status + short redacted text; requests, study text and keys are never logged.
- **Production safety.** Wildcard CORS is rejected in production, and `HOST`/`PORT` follow the platform.

## Project documentation

Engineering documentation lives in [`Project Documentation/`](<Project Documentation>): `Architecture.md`, `Design.md`, `Memory.md`, `Phases.md` and `PRD.md`. `AGENTS.md` and `.github/copilot-instructions.md` tell AI coding assistants to read those files first and keep them updated.

## License

MIT. See [LICENSE](LICENSE).
