/**
 * Application-wide constants.
 * Central place for magic strings/values used across the backend.
 */

export const API_PREFIX = '/api';

export const CONFIG = {
  apiPrefix: API_PREFIX,
  requestSizeLimit: '1mb',
  morganFormat: 'dev',
} as const;

export const MESSAGES = {
  serverRunning: (port: number) =>
    `✈️  Airline Resolution Agent server running on http://localhost:${port} (${process.env.NODE_ENV ?? 'development'})`,
  serverError: '❌ Unhandled server error:',
  gracefulShutdown: '🛑 Received shutdown signal, closing server...',
  shutdownComplete: '✅ Server closed. Goodbye!',
} as const;
