/**
 * Customer endpoints.
 * Read-only: all data comes from the validated data layer via services.
 */

import type { Request, Response } from 'express';

import {
  getCustomerByPnr,
  getCustomerProfile,
} from '../services/customer.service';
import { getAllCustomers } from '../services/customer.service';
import { notFoundError } from '../middleware/error.middleware';

/** GET /api/customers */
export function getAllCustomersHandler(_req: Request, res: Response): void {
  res.status(200).json({ success: true, data: getAllCustomers() });
}

/** GET /api/customers/:pnr — full profile (customer + booking legs). */
export function getCustomerByPnrHandler(req: Request, res: Response): void {
  const pnr = req.params.pnr as string;
  const profile = getCustomerProfile(pnr);

  if (!profile) {
    throw notFoundError(`No customer found for PNR ${pnr.toUpperCase()}.`);
  }

  res.status(200).json({ success: true, data: profile });
}

/** GET /api/customers/:pnr/bookings — booking legs for one customer. */
export function getCustomerBookingsHandler(req: Request, res: Response): void {
  const pnr = req.params.pnr as string;
  const customer = getCustomerByPnr(pnr);

  if (!customer) {
    throw notFoundError(`No customer found for PNR ${pnr.toUpperCase()}.`);
  }

  const profile = getCustomerProfile(customer.pnr)!;
  res.status(200).json({ success: true, data: profile.bookings });
}
