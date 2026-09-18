/**
 * Audit record contract.
 * One record per customer interaction: what was asked, which policy applied,
 * what was decided, what was executed, and whether a human took over.
 * Persisted to src/data/audit-logs.json (validated on every read/write).
 */

export interface AuditRecord {
  /** uuid v4. */
  id: string;
  /** Booking reference the interaction relates to. */
  pnr: string;
  /** Customer name (from validated data, never invented). */
  customer: string;
  /** Detected intent (see intent.types). */
  intent: string;
  /** Source labels of the policy rules applied to reach the decision. */
  policyUsed: string[];
  /** Human-readable deterministic decision summary. */
  decision: string;
  /** Executed (simulated) action descriptions, e.g. 'issue_meal_voucher:completed'. */
  actions: string[];
  /** Escalation reason when escalated, null otherwise. */
  escalation: string | null;
  /** ISO 8601 timestamp with offset. */
  timestamp: string;
}
