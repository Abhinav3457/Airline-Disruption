/**
 * Customer service.
 * Read-only lookups over the zod-validated seed data. Never invents data:
 * not-found lookups return `undefined` and callers decide how to respond.
 */

import type { Customer, CustomerProfile } from '../types';

import { getBookings, getCustomers } from '../data/store';

import { normalizeName, normalizePnr } from '../utils/strings';

/** All customers, in assignment order. */
export function getAllCustomers(): Customer[] {
  return getCustomers();
}

/** Find a customer by PNR (case-insensitive), or undefined. */
export function getCustomerByPnr(pnr: string): Customer | undefined {
  const normalized = normalizePnr(pnr);
  if (normalized === '') return undefined;

  return getCustomers().find((customer) => customer.pnr === normalized);
}

/** Find a customer by full name (case-insensitive, whitespace-normalized), or undefined. */
export function getCustomerByName(name: string): Customer | undefined {
  const normalized = normalizeName(name);
  if (normalized === '') return undefined;

  return getCustomers().find(
    (customer) => normalizeName(customer.name) === normalized
  );
}

/**
 * Full customer profile: the customer plus all of their booking legs.
 * Returns undefined when the PNR is unknown.
 */
export function getCustomerProfile(pnr: string): CustomerProfile | undefined {
  const customer = getCustomerByPnr(pnr);
  if (!customer) return undefined;

  const bookings = getBookings().filter(
    (booking) => booking.pnr === customer.pnr
  );

  return { ...customer, bookings };
}
