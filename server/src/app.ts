import cors from "cors";
import express, { type Express } from "express";
import type { AppConfig } from "./config";
import type { LearningService } from "./learning";
import { errorHandler, notFoundHandler } from "./middleware";
import type { GemmaClient } from "./gemma";
import { createRouter } from "./routes";
import type { RequestSchemas } from "./schemas";

export function createApp(deps: {
  config: AppConfig;
  gemma: GemmaClient;
  learning: LearningService;
  schemas: RequestSchemas;
}): Express {
  const { config } = deps;
  const app = express();
  app.disable("x-powered-by");

  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = !origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin);
        callback(null, allowed);
      },
    }),
  );

  // Body limit scales with MAX_INPUT_CHARS (worst case 4 bytes/char + JSON overhead).
  const bodyLimitKb = Math.ceil((config.limits.maxInputChars * 4) / 1024) + 16;
  app.use(express.json({ limit: `${bodyLimitKb}kb` }));

  app.use("/api/v1", createRouter(deps));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
