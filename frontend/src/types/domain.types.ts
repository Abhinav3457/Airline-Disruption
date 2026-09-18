/**
 * Domain types for the frontend.
 * Mirrored from the backend contracts (src/types in the server) — do not
 * invent fields the API does not return.
 */

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type LoyaltyTier = 'Silver' | 'Gold' | 'Platinum';

export interface PreviousComplaint {
  issue: string;
  resolution: string;
}

export interface TravelHistory {
  flightsLast12Months: number;
}

export interface Customer {
  name: string;
  loyaltyTier: LoyaltyTier;
  pnr: string;
  email: string;
  phone: string;
  travelHistory: TravelHistory;
  previousComplaints: PreviousComplaint[];
}

export type Booking = BookingBase & BookingStatusData;

interface BookingBase {
  pnr: string;
  /** Flight number (e.g. 'SK-204') or the label 'Return'. */
  flight: string;
  route: { from: string; to: string };
  /** ISO date, e.g. '2026-09-23'. */
  date: string;
  /** 24h local time, e.g. '18:40'. */
  scheduledDeparture: string;
}

type BookingStatusData =
  | { status: 'Cancelled'; cancellationReason: string }
  | { status: 'Delayed'; delayHours: number; newDeparture: string }
  | { status: 'Unaffected' };

/** Customer + all booking legs (GET /api/customers/:pnr). */
export interface CustomerProfile extends Customer {
  bookings: Booking[];
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export interface PolicyEnvelope<TDetails = unknown> {
  policyId: string;
  source: string;
  details: TDetails;
}

export interface DelayPolicyTier {
  condition: string;
  upToHours?: number;
  moreThanHours?: number;
  entitlements: string[];
}

export interface AllowedAction {
  id: string;
  action: string;
}

export interface AllPolicies {
  cancellation: PolicyEnvelope<{ options: string[] }>;
  delay: PolicyEnvelope<{ tiers: DelayPolicyTier[] }>;
  refund: PolicyEnvelope<{ type: string; timeframe: string; method: string }>;
  fareDifference: PolicyEnvelope<{
    rule: string;
    maxWaiverWithoutApprovalInr: number;
    approvalRule: string;
  }>;
  loyalty: PolicyEnvelope<{
    priorityRebookingTiers: LoyaltyTier[];
    additionalCompensation: string;
  }>;
  allowedActions: PolicyEnvelope<AllowedAction[]>;
  prohibited: PolicyEnvelope<string[]>;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export type DecisionStatus =
  | 'eligible'
  | 'partially_eligible'
  | 'ineligible'
  | 'escalation_required'
  | 'clarification_required';

export interface PolicyDecision {
  status: DecisionStatus;
  eligibleActions: string[];
  ineligibleActions: string[];
  requiresEscalation: boolean;
  escalationReason: string | null;
  policySources: string[];
  explanation: string;
}

export interface EscalationInfo {
  required: boolean;
  trigger: string;
  reason: string;
  status: string;
  priority: 'high' | 'medium' | 'low';
  pnr?: string;
  timestamp: string;
}

/** One simulated action as exposed by the chat response. */
export interface AgentAction {
  id: string;
  action: string;
  status: string;
  reason: string;
  timestamp: string;
}

/** POST /api/agent/chat request. */
export interface ChatRequest {
  pnr: string;
  message: string;
}

/** POST /api/agent/chat response payload. */
export interface ChatData {
  message: string;
  intent: string;
  customer: Customer | null;
  booking: Booking | null;
  policyUsed: string[];
  decision: PolicyDecision;
  actions: AgentAction[];
  escalation: EscalationInfo | null;
  auditId: string;
  llmUsed: boolean;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditRecord {
  id: string;
  pnr: string;
  customer: string;
  intent: string;
  policyUsed: string[];
  decision: string;
  /** Executed action summaries, e.g. 'issue_meal_voucher:completed'. */
  actions: string[];
  escalation: string | null;
  timestamp: string;
}
