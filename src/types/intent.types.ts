/**
 * Intent-detection types.
 * The detector classifies what the customer is asking for. It NEVER decides
 * eligibility — policy decisions belong exclusively to the policy engine.
 */

export const INTENTS = [
  'flight_status',
  'cancellation_support',
  'refund_request',
  'rebooking_request',
  'delay_compensation',
  'meal_voucher_request',
  'lounge_request',
  'hotel_request',
  'fare_difference_request',
  'upgrade_request',
  'legal_complaint',
  'unknown',
] as const;

export type Intent = (typeof INTENTS)[number];

/** Entities extracted from the customer message (all optional). */
export interface IntentEntities {
  /** PNR mentioned in the message, normalized (e.g. 'SK4821X'). */
  pnr?: string;
  /** Flight number mentioned (e.g. 'SK-118'). */
  flightNumber?: string;
  /** Payment method referenced: 'original' or 'different'. */
  paymentMethod?: string;
  /** Monetary amount parsed from ₹/INR mentions (e.g. ₹2,000 -> 2000). */
  waiverAmountInr?: number;
}

export interface IntentResult {
  intent: Intent;
  /** 0..0.99 rule-based confidence; 0 for unknown. */
  confidence: number;
  entities: IntentEntities;
}
