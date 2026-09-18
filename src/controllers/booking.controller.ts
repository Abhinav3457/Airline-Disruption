/**
 * Booking endpoints.
 * Read-only lookups over the validated booking data.
 */

import type { Request, Response } from 'express';

import {
  getBookingStatus,
  getBookingsByPnr,
} from '../services/booking.service';
import { notFoundError } from '../middleware/error.middleware';

/** GET /api/bookings/:pnr — all legs for a PNR. */
export function getBookingsByPnrHandler(req: Request, res: Response): void {
  const pnr = req.params.pnr as string;
  const bookings = getBookingsByPnr(pnr);

  if (bookings.length === 0) {
    throw notFoundError(`No bookings found for PNR ${pnr.toUpperCase()}.`);
  }

  res.status(200).json({ success: true, data: bookings });
}

/** GET /api/bookings/:pnr/status — legs + primary disruption summary. */
export function getBookingStatusHandler(req: Request, res: Response): void {
  const pnr = req.params.pnr as string;
  const status = getBookingStatus(pnr);

  if (!status) {
    throw notFoundError(`No bookings found for PNR ${pnr.toUpperCase()}.`);
  }

  res.status(200).json({ success: true, data: status });
}
