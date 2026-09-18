import { Router } from 'express';

import {
  getBookingStatusHandler,
  getBookingsByPnrHandler,
} from '../controllers/booking.controller';

import { parseOrThrow, pnrParamSchema } from '../middleware/validation.middleware';

const router = Router();

// Validate :pnr before handlers run.
router.use('/:pnr', (req, _res, next) => {
  parseOrThrow(pnrParamSchema, { pnr: req.params.pnr });
  next();
});

// GET /api/bookings/:pnr
router.get('/:pnr', getBookingsByPnrHandler);

// GET /api/bookings/:pnr/status — legs + primary disruption summary
router.get('/:pnr/status', getBookingStatusHandler);

export default router;
