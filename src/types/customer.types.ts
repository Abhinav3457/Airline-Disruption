/**
 * Customer domain types.
 * Field values mirror the assignment data exactly (names, PNRs, phone masks, etc.).
 */

export const LOYALTY_TIERS = ['Silver', 'Gold', 'Platinum'] as const;

export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];

/** A past complaint and how it was resolved (wording kept verbatim from source data). */
export interface PreviousComplaint {
  issue: string;
  resolution: string;
}

export interface TravelHistory {
  flightsLast12Months: number;
}

export interface Customer {
  name: string;
  loyaltyTier: LoyaltyTier;
  /** Primary lookup key; customers and their bookings share the same PNR. */
  pnr: string;
  email: string;
  phone: string;
  travelHistory: TravelHistory;
  /** Empty array means no previous complaints. */
  previousComplaints: PreviousComplaint[];
}
