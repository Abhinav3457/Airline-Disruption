/**
 * Shared zod request-validation schemas.
 * Controllers parse inputs through these and receive typed, normalized data;
 * invalid input raises an AppError(400) with field-level issues.
 */

import { z } from 'zod';

import { ESCALATION_TRIGGERS, EXECUTABLE_ACTIONS } from '../types';

import { AppError, type ErrorIssue } from './error.middleware';

/** PNR: 5-8 alphanumerics; normalized to uppercase. */
export const pnrParamSchema = z.object({
  pnr: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{5,8}$/, 'PNR must be 5-8 letters/digits')
    .transform((value) => value.toUpperCase()),
});

/** Query for the audit list endpoint (optional PNR filter). */
export const auditQuerySchema = z.object({
  pnr: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{5,8}$/, 'PNR must be 5-8 letters/digits')
    .transform((value) => value.toUpperCase())
    .optional(),
});

/** POST /api/agent/chat request body. */
export const chatRequestSchema = z.object({
  pnr: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{5,8}$/, 'PNR must be 5-8 letters/digits')
    .transform((value) => value.toUpperCase())
    .optional(),
  message: z
    .string({ message: 'message is required' })
    .trim()
    .min(1, 'message is required'),
});

/** POST /api/actions/execute request body. */
export const executeActionSchema = z.object({
  pnr: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{5,8}$/, 'PNR must be 5-8 letters/digits')
    .transform((value) => value.toUpperCase()),
  action: z.enum(EXECUTABLE_ACTIONS),
  reason: z.string().trim().min(1, 'reason is required'),
});

/** POST /api/escalations request body. */
export const escalationSchema = z.object({
  trigger: z.enum(ESCALATION_TRIGGERS),
  pnr: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{5,8}$/, 'PNR must be 5-8 letters/digits')
    .transform((value) => value.toUpperCase())
    .optional(),
});

/**
 * Parse `input` with `schema`; on failure throw AppError(400) with
 * field-level issues so the error middleware renders the standard envelope.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues: ErrorIssue[] = result.error.issues.map((issue) => ({
      field: issue.path.map(String).join('.') || 'body',
      message: issue.message,
    }));
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Invalid request.',
      issues
    );
  }
  return result.data;
}
