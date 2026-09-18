import type { Request, Response } from 'express';

import { env } from '../config/env';

/**
 * GET /api/health
 * Simple liveness probe for the API.
 */
export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    service: 'airline-resolution-agent',
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
