/**
 * Escalation-handler types.
 * Escalation is the safe path: anything outside agent authority goes to a
 * human with a structured, auditable result.
 */

export const ESCALATION_TRIGGERS = [
  'legal_threat',
  'formal_complaint',
  'compensation_beyond_policy',
  'fare_waiver_above_limit',
  'refund_different_payment_method',
  'unauthorized_exception',
  'missing_authority',
  'unclear_request',
] as const;

export type EscalationTrigger = (typeof ESCALATION_TRIGGERS)[number];

export const ESCALATION_PRIORITIES = ['high', 'medium', 'low'] as const;

export type EscalationPriority = (typeof ESCALATION_PRIORITIES)[number];

export const ESCALATION_STATUSES = ['escalated_to_human'] as const;

export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

export interface EscalationResult {
  required: boolean;
  trigger: EscalationTrigger;
  reason: string;
  status: EscalationStatus;
  priority: EscalationPriority;
  /** PNR context when known. */
  pnr?: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}
