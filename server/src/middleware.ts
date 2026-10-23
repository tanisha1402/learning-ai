import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { redactSecrets } from "./gemma";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.path}` },
  });
};

function sendError(res: Parameters<ErrorRequestHandler>[2], status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}) } });
}

/** Consistent JSON errors. Never leaks stack traces or environment values. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    sendError(res, 400, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid request.", details);
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }

  // Errors raised by express.json()
  const type = typeof err === "object" && err !== null ? (err as { type?: unknown }).type : undefined;
  if (type === "entity.parse.failed") {
    sendError(res, 400, "INVALID_JSON", "Request body must be valid JSON.");
    return;
  }
  if (type === "entity.too.large") {
    sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
    return;
  }

  // Log name + message only (no stack, no request data), with key-like strings removed.
  console.error("[unexpected error]", redactSecrets(err instanceof Error ? `${err.name}: ${err.message}` : String(err)));
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong on the server.");
};
