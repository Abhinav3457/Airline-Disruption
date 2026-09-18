/**
 * Policy types.
 * Free-text policy wording is kept verbatim in `string` fields; only the
 * numeric thresholds explicitly present in the policy text (3h, 5h, ₹1,500)
 * are extracted as structured fields for enforcement.
 */

import type { LoyaltyTier } from './customer.types';

export interface CancellationPolicy {
  options: string[];
}

/** One delay compensation band. Thresholds are cumulative (tiers overlap). */
export interface DelayPolicyTier {
  condition: string;
  /** Exclusive upper bound in hours, e.g. 3 for 'Under 3 hours'. */
  upToHours?: number;
  /** Exclusive lower bound in hours, e.g. 3 for 'More than 3 hours'. */
  moreThanHours?: number;
  entitlements: string[];
}

export interface DelayPolicy {
  tiers: DelayPolicyTier[];
}

export interface RefundPolicy {
  type: string;
  timeframe: string;
  method: string;
}

export interface FareDifferencePolicy {
  rule: string;
  /** Waiver requests above this INR amount require supervisor approval. */
  maxWaiverWithoutApprovalInr: number;
  approvalRule: string;
}

export interface LoyaltyPolicy {
  priorityRebookingTiers: LoyaltyTier[];
  additionalCompensation: string;
}

/**
 * Actions the agent is permitted to take. IDs are code-level identifiers
 * derived 1:1 from the six allowed actions in the assignment policy.
 */
export const ALLOWED_ACTION_IDS = [
  'rebook_within_24_hours',
  'issue_meal_voucher',
  'issue_lounge_access',
  'arrange_delayed_hours_hotel',
  'initiate_refund',
  'provide_booking_status',
] as const;

export type AllowedActionId = (typeof ALLOWED_ACTION_IDS)[number];

export interface AllowedAction {
  id: AllowedActionId;
  /** Verbatim action wording from the policy. */
  action: string;
}

export interface PolicyDocument {
  cancellation: CancellationPolicy;
  delay: DelayPolicy;
  refund: RefundPolicy;
  fareDifference: FareDifferencePolicy;
  loyalty: LoyaltyPolicy;
  allowedActions: AllowedAction[];
  prohibited: string[];
}
