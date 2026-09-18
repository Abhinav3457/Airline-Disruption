/**
 * Axios client + error normalization.
 * The backend always answers with the envelope
 * { success: true, data } | { success: false, error: { code, message, issues? } }.
 * Non-2xx responses are converted into ApiError with the backend's message.
 */

import axios from 'axios';

import type { ApiErrorBody, ApiErrorIssue, ApiSuccess } from '@/types';

/** Base URL for every request (falls back to the local dev backend). */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

/** Normalized frontend error for any failed API call. */
export class ApiError extends Error {
  /** Backend error code, e.g. 'VALIDATION_ERROR' | 'NOT_FOUND'. */
  readonly code: string;
  /** HTTP status when a response was received. */
  readonly status?: number;
  /** Field-level issues from zod validation (400 responses). */
  readonly issues?: ApiErrorIssue[];

  constructor(
    message: string,
    code: string = 'UNKNOWN',
    status?: number,
    issues?: ApiErrorIssue[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Convert any axios failure into an ApiError carrying the backend message. */
function normalizeError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;

    if (body && body.success === false) {
      throw new ApiError(
        body.error.message,
        body.error.code,
        error.response?.status,
        body.error.issues
      );
    }
    if (error.code === 'ECONNABORTED') {
      throw new ApiError('The request timed out. Please try again.', 'TIMEOUT');
    }
    if (error.response) {
      throw new ApiError(
        `Request failed with status ${error.response.status}.`,
        'HTTP_ERROR',
        error.response.status
      );
    }
    throw new ApiError(
      'Cannot reach the server. Is the backend running on port 5000?',
      'NETWORK_ERROR'
    );
  }
  throw new ApiError('An unexpected error occurred.', 'UNKNOWN');
}

/** GET that unwraps the success envelope. */
export async function apiGet<T>(url: string, timeoutMs?: number): Promise<T> {
  try {
    const response = await apiClient.get<ApiSuccess<T>>(url, {
      timeout: timeoutMs,
    });
    return response.data.data;
  } catch (error) {
    normalizeError(error);
  }
}

/**
 * GET that returns the raw body. Needed for the one endpoint that does not
 * use the success envelope: GET /health answers { status, service, … }.
 */
export async function apiGetRaw<T>(url: string, timeoutMs?: number): Promise<T> {
  try {
    const response = await apiClient.get<T>(url, { timeout: timeoutMs });
    return response.data;
  } catch (error) {
    normalizeError(error);
  }
}

/** POST that unwraps the success envelope. */
export async function apiPost<T>(
  url: string,
  payload: unknown,
  timeoutMs?: number
): Promise<T> {
  try {
    const response = await apiClient.post<ApiSuccess<T>>(url, payload, {
      timeout: timeoutMs,
    });
    return response.data.data;
  } catch (error) {
    normalizeError(error);
  }
}
