import axios from "axios";
import type { Difficulty, HealthResponse, QuizPayload, SummaryLength, SummaryPayload } from "../types";

const baseURL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").replace(/\/+$/, "") || "/api/v1";

// Generation can be slow on CPU-only machines, so allow a long wait.
const http = axios.create({ baseURL, timeout: 10 * 60 * 1000 });

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: { code?: string; message?: string } } | undefined;
    if (data?.error?.message) {
      return new ApiError(data.error.message, data.error.code ?? "UNKNOWN", err.response?.status);
    }
    if (err.code === "ECONNABORTED") {
      return new ApiError("The request took too long. Try shorter text.", "CLIENT_TIMEOUT");
    }
    if (!err.response || err.response.status >= 500) {
      return new ApiError(
        "Cannot reach the LearnMate backend. Make sure it is running (npm run dev).",
        "NETWORK_ERROR",
        err.response?.status,
      );
    }
    return new ApiError(`Unexpected response from the server (HTTP ${err.response.status}).`, "HTTP_ERROR", err.response.status);
  }
  return new ApiError("Something went wrong. Please try again.", "UNKNOWN");
}

/** Health check. A 503 body ("degraded") is still a valid, informative response. */
export async function getHealth(): Promise<HealthResponse> {
  try {
    const res = await http.get<HealthResponse>("/health", {
      timeout: 8000,
      validateStatus: (s) => s === 200 || s === 503,
    });
    if (!res.data || typeof res.data !== "object" || !("provider" in res.data)) {
      throw new ApiError("Unexpected health response.", "HTTP_ERROR", res.status);
    }
    return res.data;
  } catch (err) {
    throw err instanceof ApiError ? err : toApiError(err);
  }
}

export async function generateSummary(text: string, summaryLength: SummaryLength): Promise<SummaryPayload> {
  try {
    const res = await http.post<{ summary: SummaryPayload }>("/learning/generate-summary", { text, summaryLength });
    return res.data.summary;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function generateQuiz(text: string, difficulty: Difficulty): Promise<QuizPayload> {
  try {
    const res = await http.post<{ quiz: QuizPayload }>("/learning/generate-quiz", { text, difficulty });
    return res.data.quiz;
  } catch (err) {
    throw toApiError(err);
  }
}
