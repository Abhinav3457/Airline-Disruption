/**
 * Booking domain types.
 * Modelled as a discriminated union on `status` so delay/cancellation details
 * are only accessible after narrowing on the status.
 */

export const BOOKING_STATUSES = ['Cancelled', 'Delayed', 'Unaffected'] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface Route {
  from: string;
  to: string;
}

interface BookingBase {
  /** Links the booking to the customer who holds it (customers are keyed by PNR). */
  pnr: string;
  /** Flight number (e.g. 'SK-204'), or 'Return' for the return leg, as given in the source data. */
  flight: string;
  route: Route;
  /** ISO date, e.g. '2026-09-23'. */
  date: string;
  /** 24h local time, e.g. '18:40'. */
  scheduledDeparture: string;
}

export interface CancelledBooking extends BookingBase {
  status: 'Cancelled';
  cancellationReason: string;
}

export interface DelayedBooking extends BookingBase {
  status: 'Delayed';
  delayHours: number;
  newDeparture: string;
}

export interface UnaffectedBooking extends BookingBase {
  status: 'Unaffected';
}

export type Booking = CancelledBooking | DelayedBooking | UnaffectedBooking;

/** A booking leg that is either cancelled or delayed. */
export type DisruptedBooking = CancelledBooking | DelayedBooking;

/** Compact per-leg status view used by booking-status summaries. */
export interface BookingLegStatus {
  flight: string;
  route: Route;
  date: string;
  scheduledDeparture: string;
  status: BookingStatus;
}

/** The single most disruptive leg for a PNR, if any. */
export interface DisruptionSummary {
  kind: 'cancellation' | 'delay';
  flight: string;
  date: string;
  scheduledDeparture: string;
  /** Present when kind === 'delay'. */
  delayHours?: number;
  /** Present when kind === 'cancellation'. */
  cancellationReason?: string;
}

/** Structured status answer for a PNR (all legs + primary disruption). */
export interface BookingStatusSummary {
  pnr: string;
  totalLegs: number;
  legs: BookingLegStatus[];
  hasDisruption: boolean;
  /** Cancellation takes precedence over delay; null when nothing is disrupted. */
  primaryDisruption: DisruptionSummary | null;
}
