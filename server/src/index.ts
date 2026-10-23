import dotenv from "dotenv";
import path from "node:path";
import { createApp } from "./app";
import { loadConfig, type AppConfig } from "./config";
import { LearningService } from "./learning";
import { GemmaClient } from "./gemma";
import { buildRequestSchemas } from "./schemas";

// server/.env (works from both src/ and dist/)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

let config: AppConfig;
try {
  config = loadConfig(process.env);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const gemma = new GemmaClient(config.gemma);
const learning = new LearningService(gemma, config.gemma);
const schemas = buildRequestSchemas(config.limits);
const app = createApp({ config, gemma, learning, schemas });

const server = app.listen(config.port, config.host, () => {
  console.log(`LearnMate API listening on http://${config.host}:${config.port}/api/v1`);
  console.log(`Model: ${config.gemma.model} (Gemini API). API key configured: ${config.gemma.apiKey ? "yes" : "NO - set GEMMA_API_KEY"}`);
  console.log(`CORS origins: ${config.corsOrigins.join(", ")}`);
  console.log("No model calls are made at startup. Check readiness at GET /api/v1/health");
});

function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
