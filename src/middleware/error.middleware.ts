/**
 * Centralized error handling.
 * AppError is the single error type controllers/services throw for expected
 * failures; everything else is treated as an internal error.
 * Responses always use the API envelope and never leak stack traces.
 */

import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';

export interface ErrorIssue {
  field: string;
  message: string;
}

/** Standard API error body. */
export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    issues?: ErrorIssue[];
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly issues?: ErrorIssue[];

  constructor(statusCode: number, code: string, message: string, issues?: ErrorIssue[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.issues = issues;
  }
}

/** Well-known constructors for the common failure modes. */
export const badRequest = (message: string, issues?: ErrorIssue[]) =>
  new AppError(400, 'VALIDATION_ERROR', message, issues);

export const notFoundError = (message: string) =>
  new AppError(404, 'NOT_FOUND', message);

/** Wrap a request handler (sync or async) so rejections reach the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const result = handler(req, res, next);
    if (result instanceof Promise) {
      result.catch(next);
    }
  };
}

/** 404 for unmatched routes, normalized to the API envelope. */
export function notFoundHandler(_req: Request, res: Response): void {
  const body: ApiErrorBody = {
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found.' },
  };
  res.status(404).json(body);
}

/**
 * Final error middleware: consistent envelope, no stack traces in responses.
 * NOTE: must keep arity 4 — Express identifies error handlers by function length.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.issues ? { issues: err.issues } : {}),
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // Body-parser JSON syntax errors: normalize to 400.
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body.' },
    } satisfies ApiErrorBody);
    return;
  }

  // Unexpected failure: log server-side, return a generic message.
  console.error('Unhandled error:', err);
  const body: ApiErrorBody = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  };
  res.status(500).json(body);
  void env; // env is available for future prod/dev response differentiation
}
