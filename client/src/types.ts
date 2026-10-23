// These mirror the backend response shapes (server/src/types.ts).
export type SummaryLength = "short" | "medium" | "detailed";
export type Difficulty = "easy" | "medium" | "hard";

export interface GenerationMeta {
  model: string;
  durationMs: number;
  outputTokens: number | null;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SummaryPayload {
  text: string;
  length: SummaryLength;
  meta: GenerationMeta;
}

export interface QuizPayload {
  questions: QuizQuestion[];
  difficulty: Difficulty;
  meta: GenerationMeta;
}

export type ProviderState =
  | "ready"
  | "not_configured"
  | "auth_failed"
  | "model_not_found"
  | "rate_limited"
  | "unreachable"
  | "error";

export interface HealthResponse {
  status: "ok" | "degraded";
  provider: { name: string; model: string; state: ProviderState };
  limits: { maxInputChars: number; minInputChars: number };
  message: string;
}

export type PanelStatus = "idle" | "loading" | "success" | "error";

export interface Panel<T> {
  status: PanelStatus;
  data: T | null;
  error: string | null;
}
