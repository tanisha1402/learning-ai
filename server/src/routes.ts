import { Router } from "express";
import type { AppConfig } from "./config";
import { createHealthController, createLearningController, liveHandler } from "./controllers";
import type { LearningService } from "./learning";
import type { GemmaClient } from "./gemma";
import type { RequestSchemas } from "./schemas";

export function createRouter(deps: {
  config: AppConfig;
  gemma: GemmaClient;
  learning: LearningService;
  schemas: RequestSchemas;
}): Router {
  const router = Router();
  const learning = createLearningController(deps.learning, deps.schemas);

  router.get("/health/live", liveHandler);
  router.get("/health", createHealthController(deps.config, deps.gemma));
  router.post("/learning/generate-summary", learning.generateSummary);
  router.post("/learning/generate-quiz", learning.generateQuiz);
  router.post("/learning/generate", learning.generateAll);

  return router;
}
