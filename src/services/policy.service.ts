/**
 * Policy service.
 * Returns the supplied assignment rules as structured, typed envelopes:
 * `{ policyId, source, details }`. This service adds no rules of its own —
 * it only labels and exposes what the data layer validated.
 */

import type {
  AllowedAction,
  AllPolicies,
  CancellationPolicy,
  DelayPolicy,
  FareDifferencePolicy,
  LoyaltyPolicy,
  PolicyEnvelope,
  RefundPolicy,
} from '../types';

import { getPolicies } from '../data/store';

/** Source labels identify where each rule comes from, per the assignment. */
const SOURCES = {
  cancellation: 'Supplied Service Rules - Cancellation Rule',
  delay: 'Supplied Service Rules - Delay Compensation Rule',
  refund: 'Supplied Service Rules - Refund Rule',
  fareDifference: 'Supplied Service Rules - Fare Difference Rule',
  loyalty: 'Supplied Service Rules - Loyalty Rule',
  allowedActions: 'Supplied Service Rules - Allowed Actions',
  prohibited: 'Supplied Service Rules - Prohibited Actions',
} as const;

const POLICY_IDS = {
  cancellation: 'cancellation',
  delay: 'delay_compensation',
  refund: 'refund',
  fareDifference: 'fare_difference',
  loyalty: 'loyalty',
  allowedActions: 'allowed_actions',
  prohibited: 'prohibited_actions',
} as const;

function envelope<TDetails>(
  policyId: string,
  source: string,
  details: TDetails
): PolicyEnvelope<TDetails> {
  return { policyId, source, details };
}

/** All policy categories, each in its own envelope. */
export function getAllPolicies(): AllPolicies {
  return {
    cancellation: getCancellationPolicy(),
    delay: getDelayCompensationPolicy(),
    refund: getRefundPolicy(),
    fareDifference: getFareDifferencePolicy(),
    loyalty: getLoyaltyPolicy(),
    allowedActions: getAllowedActions(),
    prohibited: getProhibitedActions(),
  };
}

/** Cancellation: free rebooking within 24h OR full refund. */
export function getCancellationPolicy(): PolicyEnvelope<CancellationPolicy> {
  return envelope(
    POLICY_IDS.cancellation,
    SOURCES.cancellation,
    getPolicies().cancellation
  );
}

/** Delay compensation bands: <3h, >3h, >5h (cumulative entitlements). */
export function getDelayCompensationPolicy(): PolicyEnvelope<DelayPolicy> {
  return envelope(POLICY_IDS.delay, SOURCES.delay, getPolicies().delay);
}

/** Refund: full refund, 7 business days, original payment method only. */
export function getRefundPolicy(): PolicyEnvelope<RefundPolicy> {
  return envelope(POLICY_IDS.refund, SOURCES.refund, getPolicies().refund);
}

/** Fare difference: customer pays; waiver above ₹1,500 needs supervisor approval. */
export function getFareDifferencePolicy(): PolicyEnvelope<FareDifferencePolicy> {
  return envelope(
    POLICY_IDS.fareDifference,
    SOURCES.fareDifference,
    getPolicies().fareDifference
  );
}

/** Loyalty: priority rebooking for Gold/Platinum; no extra compensation. */
export function getLoyaltyPolicy(): PolicyEnvelope<LoyaltyPolicy> {
  return envelope(POLICY_IDS.loyalty, SOURCES.loyalty, getPolicies().loyalty);
}

/** The six actions the agent is allowed to take, with stable ids. */
export function getAllowedActions(): PolicyEnvelope<AllowedAction[]> {
  return envelope(
    POLICY_IDS.allowedActions,
    SOURCES.allowedActions,
    getPolicies().allowedActions
  );
}

/** Actions explicitly prohibited for the agent. */
export function getProhibitedActions(): PolicyEnvelope<string[]> {
  return envelope(
    POLICY_IDS.prohibited,
    SOURCES.prohibited,
    getPolicies().prohibited
  );
}
