/**
 * Audit endpoints.
 * Read-only queries over the persisted audit trail.
 */

import type { Request, Response } from 'express';

import {
  getAllAuditRecords,
  getAuditRecordsByPnr,
} from '../services/audit.service';

import {
  auditQuerySchema,
  parseOrThrow,
} from '../middleware/validation.middleware';

/** GET /api/audit — all records, or filtered with ?pnr=XXX. */
export function getAllAuditRecordsHandler(req: Request, res: Response): void {
  const query = parseOrThrow(auditQuerySchema, req.query);
  const records = query.pnr
    ? getAuditRecordsByPnr(query.pnr)
    : getAllAuditRecords();

  res.status(200).json({ success: true, data: records });
}

/** GET /api/audit/:pnr — audit records for one PNR. */
export function getAuditByPnrHandler(req: Request, res: Response): void {
  const pnr = req.params.pnr as string;
  res.status(200).json({ success: true, data: getAuditRecordsByPnr(pnr) });
}
