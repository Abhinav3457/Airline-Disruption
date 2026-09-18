import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { CONFIG, API_PREFIX } from './config/constants';
import { env } from './config/env';
import healthRouter from './routes/health.routes';
import agentRouter from './routes/agent.routes';

/**
 * Creates and configures the Express application.
 * Kept separate from server.ts so it can be tested in isolation.
 */
export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // Cross-origin resource sharing
  app.use(
    cors({
      origin: env.isProd ? undefined : '*', // tighten for production
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    })
  );

  // Request body parsing
  app.use(express.json({ limit: CONFIG.requestSizeLimit }));
  app.use(express.urlencoded({ extended: true }));

  // HTTP request logging
  if (env.isProd) {
    app.use(morgan('combined'));
  } else {
    app.use(morgan(CONFIG.morganFormat));
  }

  // Routes
  app.use(`${API_PREFIX}/health`, healthRouter);
  app.use(`${API_PREFIX}/agent`, agentRouter);

  return app;
}
