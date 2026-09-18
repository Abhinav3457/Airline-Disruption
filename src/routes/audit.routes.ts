import { Router } from 'express';

import {
  getAllAuditRecordsHandler,
  getAuditByPnrHandler,
} from '../controllers/audit.controller';

import {
  parseOrThrow,
  pnrParamSchema,
} from '../middleware/validation.middleware';

const router = Router();

// GET /api/audit            -> all records
// GET /api/audit?pnr=XXX    -> records for one PNR
router.get('/', getAllAuditRecordsHandler);

// GET /api/audit/:pnr
router.get(
  '/:pnr',
  (req, _res, next) => {
    parseOrThrow(pnrParamSchema, { pnr: req.params.pnr });
    next();
  },
  getAuditByPnrHandler
);

export default router;
