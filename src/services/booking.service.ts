/**
 * Booking service.
 * Read-only lookups and disruption summaries over the validated seed data.
 * All lookups are case-insensitive; unknown PNRs/flight numbers return
 * `undefined` rather than throwing.
 */

import type {
  Booking,
  BookingLegStatus,
  BookingStatusSummary,
  DelayedBooking,
  DisruptedBooking,
  DisruptionSummary,
} from '../types';

import { getBookings } from '../data/store';

import { normalizePnr } from '../utils/strings';

/** All booking legs for a PNR (case-insensitive). Multi-leg PNRs return every leg. */
export function getBookingsByPnr(pnr: string): Booking[] {
  const normalized = normalizePnr(pnr);
  if (normalized === '') return [];

  return getBookings().filter((booking) => booking.pnr === normalized);
}

/**
 * Find booking legs by flight number (case-insensitive exact match, e.g.
 * 'sk-118' -> SK-118). The informational label 'Return' matches return legs too.
 */
export function getBookingByFlightNumber(flightNumber: string): Booking[] {
  const normalized = flightNumber.trim().toUpperCase();
  if (normalized === '') return [];

  return getBookings().filter(
    (booking) => booking.flight.toUpperCase() === normalized
  );
}

/**
 * The primary disrupted booking for a PNR: the cancelled leg if one exists,
 * otherwise the longest delayed leg. Cancellation outranks delay because it
 * is the more severe disruption; among multiple delays the longest wins.
 */
export function getPrimaryDisruptedBooking(pnr: string): DisruptedBooking | undefined {
  const legs = getBookingsByPnr(pnr);

  const cancelled = legs.find((booking) => booking.status === 'Cancelled');
  if (cancelled) return cancelled;

  const delayed = legs.filter(
    (booking): booking is DelayedBooking => booking.status === 'Delayed'
  );
  if (delayed.length === 0) return undefined;

  return delayed.reduce((worst, current) =>
    current.delayHours > worst.delayHours ? current : worst
  );
}

/** Compact per-leg status view for a PNR. */
export function getBookingStatus(pnr: string): BookingStatusSummary | undefined {
  const normalized = normalizePnr(pnr);
  if (normalized === '') return undefined;

  const legs = getBookingsByPnr(normalized);
  if (legs.length === 0) return undefined;

  const legStatuses: BookingLegStatus[] = legs.map((booking) => ({
    flight: booking.flight,
    route: booking.route,
    date: booking.date,
    scheduledDeparture: booking.scheduledDeparture,
    status: booking.status,
  }));

  const disrupted = getPrimaryDisruptedBooking(normalized) ?? null;
  const primaryDisruption: DisruptionSummary | null = disrupted
    ? disrupted.status === 'Cancelled'
      ? {
          kind: 'cancellation',
          flight: disrupted.flight,
          date: disrupted.date,
          scheduledDeparture: disrupted.scheduledDeparture,
          cancellationReason: disrupted.cancellationReason,
        }
      : {
          kind: 'delay',
          flight: disrupted.flight,
          date: disrupted.date,
          scheduledDeparture: disrupted.scheduledDeparture,
          delayHours: disrupted.delayHours,
        }
    : null;

  return {
    pnr: normalized,
    totalLegs: legs.length,
    legs: legStatuses,
    hasDisruption: primaryDisruption !== null,
    primaryDisruption,
  };
}
