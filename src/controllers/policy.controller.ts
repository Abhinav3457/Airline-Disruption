/**
 * Policy endpoints.
 * Exposes the supplied policy rules as structured envelopes; read-only.
 */

import type { Request, Response } from 'express';

import { getAllPolicies } from '../services/policy.service';

/** GET /api/policies — every policy category with policyId/source/details. */
export function getPoliciesHandler(_req: Request, res: Response): void {
  res.status(200).json({ success: true, data: getAllPolicies() });
}
