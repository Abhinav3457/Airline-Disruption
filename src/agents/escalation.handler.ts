/**
 * Escalation handler.
 * Routes anything outside agent authority to a human, with a structured and
 * auditable result. Trigger classification is deterministic; priority mapping
 * is fixed (legal/formal = high, money-related = medium, unclear = low).
 */

import type {
  EscalationPriority,
  EscalationResult,
  EscalationTrigger,
} from '../types';

import {
  ESCALATION_PRIORITIES,
  ESCALATION_TRIGGERS,
} from '../types';

/** Fixed trigger -> priority mapping (deterministic, no LLM involved). */
const PRIORITY_MAP: Record<EscalationTrigger, EscalationPriority> = {
  legal_threat: 'high',
  formal_complaint: 'high',
  compensation_beyond_policy: 'medium',
  fare_waiver_above_limit: 'medium',
  refund_different_payment_method: 'medium',
  unauthorized_exception: 'high',
  missing_authority: 'medium',
  unclear_request: 'low',
};

const REASONS: Record<EscalationTrigger, string> = {
  legal_threat:
    'Customer mentioned legal action; legal matters require human handling.',
  formal_complaint:
    'Formal complaint raised; agents must not resolve these without escalation.',
  compensation_beyond_policy:
    'Requested compensation exceeds the supplied policy limits.',
  fare_waiver_above_limit:
    'Fare-difference waiver above ₹1,500 requires supervisor approval.',
  refund_different_payment_method:
    'Refund to a payment method other than the original is prohibited for agents.',
  unauthorized_exception:
    'Requested exception is not permitted under the supplied policy.',
  missing_authority:
    'Agent has no authority for this request; human review required.',
  unclear_request:
    'Request could not be resolved automatically; needs human review.',
};

export function isEscalationTrigger(value: unknown): value is EscalationTrigger {
  return (
    typeof value === 'string' &&
    (ESCALATION_TRIGGERS as readonly string[]).includes(value)
  );
}

/**
 * Create an escalation result for a trigger.
 * Returns `required: true` with status 'escalated_to_human' and the mapped
 * priority. PNR is attached when known for audit continuity.
 */
export function escalate(
  trigger: EscalationTrigger,
  options?: { pnr?: string }
): EscalationResult {
  return {
    required: true,
    trigger,
    reason: REASONS[trigger],
    status: 'escalated_to_human',
    priority: PRIORITY_MAP[trigger],
    ...(options?.pnr ? { pnr: options.pnr.trim().toUpperCase() } : {}),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Convenience passthrough: when no escalation is needed, produce a
 * `required: false` result so callers get a uniform shape.
 */
export function noEscalation(): {
  required: false;
  reason: null;
  status: 'no_escalation';
  priority: null;
  timestamp: string;
} {
  return {
    required: false,
    reason: null,
    status: 'no_escalation',
    priority: null,
    timestamp: new Date().toISOString(),
  };
}

export { ESCALATION_PRIORITIES };
