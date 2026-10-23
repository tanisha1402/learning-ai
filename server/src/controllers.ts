import type { Request, RequestHandler, Response } from "express";
import type { AppConfig } from "./config";
import type { LearningService } from "./learning";
import type { GemmaClient, ProviderState } from "./gemma";
import type { RequestSchemas } from "./schemas";

/** Express 4 does not catch rejected promises by itself. */
export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function createLearningController(learning: LearningService, schemas: RequestSchemas) {
  return {
    generateSummary: asyncHandler(async (req, res) => {
      const { text, summaryLength } = schemas.generateSummary.parse(req.body);
      const summary = await learning.generateSummary(text, summaryLength);
      res.json({ summary });
    }),
    generateQuiz: asyncHandler(async (req, res) => {
      const { text, difficulty } = schemas.generateQuiz.parse(req.body);
      const quiz = await learning.generateQuiz(text, difficulty);
      res.json({ quiz });
    }),
    generateAll: asyncHandler(async (req, res) => {
      const { text, summaryLength, difficulty } = schemas.generateAll.parse(req.body);
      const result = await learning.generateAll(text, summaryLength, difficulty);
      res.json(result);
    }),
  };
}

const HEALTH_MESSAGES: Record<ProviderState, string> = {
  ready: "Ready.",
  not_configured:
    "The server has no GEMMA_API_KEY. Add it to server/.env (local) or the Render environment (deployed), then restart.",
  auth_failed: "Google rejected the API key. Check GEMMA_API_KEY.",
  model_not_found: "The configured model was not found. Check GEMMA_MODEL.",
  rate_limited: "The free-tier rate limit was reached. Wait a moment, then refresh.",
  unreachable: "Cannot reach the Gemma API. Check the server's internet connection.",
  error: "The Gemma API returned an unexpected response. Check the server logs.",
};

/** Liveness: always 200 while the process is up. Used by hosting platforms; never calls the provider. */
export const liveHandler: RequestHandler = (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
};

/** Readiness: checks the hosted provider with a metadata request (no text generation, no quota use for generation). */
export function createHealthController(config: AppConfig, gemma: GemmaClient) {
  return asyncHandler(async (_req, res) => {
    const { state } = await gemma.getStatus();
    const ok = state === "ready";
    res.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      app: { status: "ok", uptimeSeconds: Math.round(process.uptime()) },
      provider: { name: "Google Gemini API", model: config.gemma.model, state },
      limits: config.limits,
      message: HEALTH_MESSAGES[state],
    });
  });
}
