/**
 * API envelope + probe types.
 * Mirrors the backend's uniform response shape exactly:
 *   success -> { success: true, data: T }
 *   failure -> { success: false, error: { code, message, issues? } }
 */

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorIssue {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    issues?: ApiErrorIssue[];
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiErrorBody;

/** GET /api/health payload. */
export interface HealthInfo {
  status: string;
  service: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}
