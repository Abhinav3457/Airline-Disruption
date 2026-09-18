/**
 * Simulated action-execution types.
 * The executor NEVER performs prohibited actions: every record carries the
 * authorization verdict in its status and reason.
 */

import type { AllowedActionId } from './policy.types';

/**
 * Actions the executor can simulate. Per the assignment, booking status is
 * informational (no execution) and fare waivers go through the policy engine.
 */
export const EXECUTABLE_ACTIONS = [
  'initiate_refund',
  'request_rebooking',
  'issue_meal_voucher',
  'issue_lounge_access',
  'arrange_delayed_hours_hotel',
] as const;

export type ExecutableAction = (typeof EXECUTABLE_ACTIONS)[number];

export const EXECUTED_ACTION_STATUSES = ['completed', 'failed'] as const;

export type ExecutedActionStatus = (typeof EXECUTED_ACTION_STATUSES)[number];

/** Input for executing a simulated action. */
export interface ExecuteActionInput {
  pnr: string;
  action: ExecutableAction;
  /** Why this action is being taken (kept verbatim in the record). */
  reason: string;
}

/** One simulated action execution (also embedded in audit records). */
export interface ExecutedAction {
  /** uuid v4. */
  id: string;
  pnr: string;
  action: ExecutableAction;
  /** 'completed' when policy-authorized, 'failed' when refused. */
  status: ExecutedActionStatus;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Authorization verdict / refusal reason. */
  reason: string;
  /** Always true in this build: nothing touches real airline systems. */
  simulated: true;
}

/**
 * Maps each executable action to the policy-engine action id used for
 * authorization (request_rebooking is authorized via the cancellation
 * rebooking rule).
 */
export const AUTHORIZATION_ACTION_MAP: Record<ExecutableAction, AllowedActionId> = {
  initiate_refund: 'initiate_refund',
  request_rebooking: 'rebook_within_24_hours',
  issue_meal_voucher: 'issue_meal_voucher',
  issue_lounge_access: 'issue_lounge_access',
  arrange_delayed_hours_hotel: 'arrange_delayed_hours_hotel',
};
