import { createApp } from './app';
import { env } from './config/env';
import { MESSAGES } from './config/constants';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(MESSAGES.serverRunning(env.port));
});

/**
 * Graceful shutdown on SIGINT (Ctrl+C) / SIGTERM.
 */
function shutdown(signal: string): void {
  console.log(`\n${MESSAGES.gracefulShutdown} (${signal})`);
  server.close(() => {
    console.log(MESSAGES.shutdownComplete);
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error(MESSAGES.serverError, reason);
});

process.on('uncaughtException', (err) => {
  console.error(MESSAGES.serverError, err);
  process.exit(1);
});
