export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_ERROR"
  | "AI_RATE_LIMITED"
  | "AI_UNREACHABLE"
  | "AI_TIMEOUT"
  | "AI_ERROR"
  | "MODEL_NOT_FOUND"
  | "MODEL_EMPTY_RESPONSE"
  | "MODEL_OUTPUT_INVALID"
  | "SERVER_BUSY"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

/** An error whose message is safe to show to the browser. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
