/**
 * Agent action audit-log types.
 * action-logs.json starts empty; entries are appended at runtime when the
 * agent performs an allowed action.
 */

import type { AllowedActionId } from './policy.types';

export const ACTION_STATUSES = ['succeeded', 'failed', 'requires_approval'] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface ActionLog {
  /** uuid v4. */
  id: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  pnr: string;
  action: AllowedActionId;
  status: ActionStatus;
  /** Free-text detail of what was done, e.g. rebooking details or voucher amount. */
  details: string;
}
