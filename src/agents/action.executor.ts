/**
 * Simulated action executor.
 * Executes ONLY the five allowed simulated actions, and only when the
 * deterministic policy engine authorizes them. Every execution produces a
 * full record (id, PNR, action, status, timestamp, reason, simulated flag);
 * prohibited or unauthorized requests are recorded as 'failed', never executed.
 */

import { randomUUID } from 'node:crypto';

import type {
  ActionContext,
  ExecutedAction,
  ExecutableAction,
  ExecuteActionInput,
} from '../types';

import {
  AUTHORIZATION_ACTION_MAP,
  EXECUTABLE_ACTIONS,
} from '../types';

import { evaluateActionAuthorization } from './policy.engine';

import {
  getPrimaryDisruptedBooking,
  getBookingsByPnr,
} from '../services/booking.service';

import { findCustomerByPnr } from '../data/store';

function isExecutableAction(value: unknown): value is ExecutableAction {
  return (
    typeof value === 'string' &&
    (EXECUTABLE_ACTIONS as readonly string[]).includes(value)
  );
}

/**
 * Execute (simulate) an action after policy authorization.
 * Authorization is derived from the customer's real booking + loyalty data —
 * no invented context.
 */
export function executeAction(input: ExecuteActionInput): ExecutedAction {
  const pnr = input.pnr.trim().toUpperCase();

  const booking = getPrimaryDisruptedBooking(pnr) ?? getBookingsByPnr(pnr)[0] ?? null;
  const customer = findCustomerByPnr(pnr) ?? null;

  const context: ActionContext = { customer, booking };
  const auth = evaluateActionAuthorization(
    AUTHORIZATION_ACTION_MAP[input.action],
    context
  );

  const record: ExecutedAction = {
    id: randomUUID(),
    pnr,
    action: input.action,
    status: auth.authorized ? 'completed' : 'failed',
    timestamp: new Date().toISOString(),
    reason: auth.authorized
      ? input.reason
      : `Refused by policy engine: ${auth.reason}`,
    simulated: true,
  };

  return record;
}

export { isExecutableAction };
