/**
 * Policy-engine types.
 * The engine makes DETERMINISTIC eligibility decisions from the supplied
 * rules — an LLM may phrase the outcome, but never decides it.
 */

import type { Booking } from './booking.types';
import type { Customer } from './customer.types';
import type { AllowedActionId } from './policy.types';

// ---------------------------------------------------------------------------
// Decision shape (exact contract required by the assignment)
// ---------------------------------------------------------------------------

export const DECISION_STATUSES = [
  'eligible',
  'partially_eligible',
  'ineligible',
  'escalation_required',
  'clarification_required',
] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/**
 * The uniform result of every policy evaluation.
 * `eligibleActions` / `ineligibleActions` use the shared action vocabulary
 * (`DecisionActionId`) so downstream layers (agent, API) can act on them
 * without re-interpreting policy text.
 */
export interface PolicyDecision {
  status: DecisionStatus;
  eligibleActions: DecisionActionId[];
  ineligibleActions: DecisionActionId[];
  requiresEscalation: boolean;
  escalationReason: string | null;
  /** Source labels of every rule applied to reach this decision. */
  policySources: string[];
  explanation: string;
}

// ---------------------------------------------------------------------------
// Evaluation inputs
// ---------------------------------------------------------------------------

/** What the customer asked for regarding a cancelled booking. */
export type CancellationRequest = 'rebook' | 'refund';

/** Actions a customer may request on a delayed booking. */
export type DelayRequestAction =
  | 'issue_meal_voucher'
  | 'issue_lounge_access'
  | 'arrange_delayed_hours_hotel'
  | 'rebook_within_24_hours';

/** Result of evaluating a single requested action against a delay. */
export interface DelayActionEvaluation {
  action: DelayRequestAction;
  granted: boolean;
  /** Human-readable rule verdict for this single action. */
  reason: string;
}

/** Context the authorization gate evaluates an action against. */
export interface ActionContext {
  customer: Customer | null;
  booking: Booking | null;
}

/**
 * Engine-level action ids. Extends the six data-layer allowed actions with
 * `priority_rebooking` and `waive_fare_difference`, both implied by the
 * supplied loyalty / fare-difference rules.
 */
export const ENGINE_ACTION_IDS = [
  'rebook_within_24_hours',
  'issue_meal_voucher',
  'issue_lounge_access',
  'arrange_delayed_hours_hotel',
  'initiate_refund',
  'provide_booking_status',
  'priority_rebooking',
  'waive_fare_difference',
] as const;

export type EngineActionId = (typeof ENGINE_ACTION_IDS)[number];

/** Union of every action id the engine may put in a decision. */
export type DecisionActionId = AllowedActionId | 'priority_rebooking' | 'waive_fare_difference';

/** Input for evaluateEscalationRequirement. */
export interface EscalationRequest {
  /** What the customer is asking for that may exceed agent authority. */
  type:
    | 'fare_waiver_above_limit'
    | 'compensation_beyond_policy'
    | 'legal_or_formal_complaint'
    | 'non_original_refund_method'
    | 'exception_non_airline_cause'
    | 'other';
  /** Free-text detail, e.g. the requested waiver amount in INR. */
  detail?: string;
}

/** Context for evaluateEscalationRequirement. */
export interface EscalationContext {
  /** When true, non-airline-cause exceptions stay prohibited; else they are moot. */
  airlineCaused: boolean;
}

/** Input for evaluateFareDifference. */
export interface FareDifferenceRequest {
  /** Waiver the customer asked for, in INR (0 = none requested). */
  requestedWaiver: number;
}
