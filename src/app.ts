import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { CONFIG, API_PREFIX } from './config/constants';
import { env } from './config/env';
import healthRouter from './routes/health.routes';
import customerRouter from './routes/customer.routes';
import bookingRouter from './routes/booking.routes';
import policyRouter from './routes/policy.routes';
import agentRouter from './routes/agent.routes';
import auditRouter from './routes/audit.routes';
import actionRouter from './routes/action.routes';
import escalationRouter from './routes/escalation.routes';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/error.middleware';

/**
 * Creates and configures the Express app.
 * Kept separate from server.ts so it can be tested in isolation.
 */
export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // Cross-origin resource sharing
  app.use(
    cors({
      origin: env.isProd ? undefined : '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    })
  );

  // Request body parsing
  app.use(express.json({ limit: CONFIG.requestSizeLimit }));
  app.use(express.urlencoded({ extended: true }));

  // HTTP request logging
  app.use(morgan(env.isProd ? 'combined' : CONFIG.morganFormat));

  // Routes
  app.use(`${API_PREFIX}/health`, healthRouter);
  app.use(`${API_PREFIX}/customers`, customerRouter);
  app.use(`${API_PREFIX}/bookings`, bookingRouter);
  app.use(`${API_PREFIX}/policies`, policyRouter);
  app.use(`${API_PREFIX}/agent`, agentRouter);
  app.use(`${API_PREFIX}/audit`, auditRouter);
  app.use(`${API_PREFIX}/actions`, actionRouter);
  app.use(`${API_PREFIX}/escalations`, escalationRouter);

  // 404 for unmatched routes, then centralized error rendering
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
