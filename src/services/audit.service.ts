/**
 * Audit service.
 * Creates and persists audit records for every customer interaction and
 * serves read-only queries over the audit trail. Records are validated with
 * zod on every read/write (see data/store.ts) and stored in
 * src/data/audit-logs.json — a safe local persistence target for this build.
 */

import { randomUUID } from 'node:crypto';

import type { AuditRecord, ExecutedAction, EscalationResult } from '../types';

import { appendAuditRecord, getAuditLogs } from '../data/store';

export interface CreateAuditRecordInput {
  pnr: string;
  customer: string;
  intent: string;
  /** Source labels of the policy rules applied. */
  policyUsed: string[];
  /** Deterministic decision summary. */
  decision: string;
  /** Executed (simulated) actions to embed as 'action:status' strings. */
  actions?: ExecutedAction[];
  /** Escalation result; null/undefined when none occurred. */
  escalation?: EscalationResult | null;
  timestamp?: string;
}

/** Shape each executed action as a compact audit string. */
function formatAction(action: ExecutedAction): string {
  return `${action.action}:${action.status}`;
}

/**
 * Create, persist, and return one audit record.
 * The customer name must come from validated data — the service never
 * invents identity information.
 */
export function createAuditRecord(input: CreateAuditRecordInput): AuditRecord {
  const record: AuditRecord = {
    id: randomUUID(),
    pnr: input.pnr.trim().toUpperCase(),
    customer: input.customer,
    intent: input.intent,
    policyUsed: input.policyUsed,
    decision: input.decision,
    actions: (input.actions ?? []).map(formatAction),
    escalation: input.escalation?.reason ?? null,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };

  appendAuditRecord(record); // zod-validated inside the store; throws if invalid
  return record;
}

/** All audit records for a PNR (oldest first), or [] when none. */
export function getAuditRecordsByPnr(pnr: string): AuditRecord[] {
  const normalized = pnr.trim().toUpperCase();
  if (normalized === '') return [];

  return getAuditLogs().filter((record) => record.pnr === normalized);
}

/** All audit records (oldest first). */
export function getAllAuditRecords(): AuditRecord[] {
  return getAuditLogs();
}
