/**
 * Main agent orchestrator.
 * Runs the full workflow:
 *   message → validate → identify customer → retrieve bookings → detect intent
 *   → policy engine → authorization → simulated execution → escalation → audit
 *   → response generation (LLM phrasing when available, deterministic otherwise).
 *
 * The deterministic policy engine is the ONLY authority on eligibility.
 * The LLM (if configured) may only rephrase the final deterministic response.
 */

import type {
  Booking,
  Customer,
  EscalationResult,
  PolicyDecision,
} from '../types';

import {
  ENGINE_RULES,
  calculateDelayCompensation,
  evaluateFareDifference,
  evaluateLoyaltyBenefits,
} from './policy.engine';

import { WAIVER_ASK, detectIntent } from './intent.detector';
import { executeAction } from './action.executor';
import { escalate } from './escalation.handler';
import { createAuditRecord } from '../services/audit.service';
import { isLlmAvailable, phraseDecision } from '../services/llm.service';

import { env } from '../config/env';
import { getCustomerByPnr } from '../services/customer.service';
import {
  getBookingsByPnr,
  getPrimaryDisruptedBooking,
} from '../services/booking.service';

// ---------------------------------------------------------------------------
// Public result contract
// ---------------------------------------------------------------------------

/** A simulated action execution as exposed through the API. */
export interface OrchestratorAction {
  id: string;
  action: string;
  status: string;
  reason: string;
  timestamp: string;
}

export interface OrchestratorResult {
  message: string;
  intent: string;
  /** Customer object when identified; null when the PNR is unknown/missing. */
  customer: Customer | null;
  /** Primary disrupted booking, or first leg; null when none. */
  booking: Booking | null;
  policyUsed: string[];
  decision: PolicyDecision;
  /** Simulated executions performed during this turn. */
  actions: OrchestratorAction[];
  /** Escalation result when escalated, null otherwise. */
  escalation: EscalationResult | null;
  /** Audit record id (record persisted by the orchestrator). */
  auditId: string;
  /** true when the visible message text came from the Groq LLM. */
  llmUsed: boolean;
}

// ---------------------------------------------------------------------------
// Deterministic response generation (always available fallback)
// ---------------------------------------------------------------------------

const SOURCE_DELAY = 'Supplied Service Rules - Delay Compensation Rule';
const SOURCE_CANCELLATION = 'Supplied Service Rules - Cancellation Rule';
const SOURCE_REFUND = 'Supplied Service Rules - Refund Rule';
const SOURCE_FARE = 'Supplied Service Rules - Fare Difference Rule';
const SOURCE_LOYALTY = 'Supplied Service Rules - Loyalty Rule';
const SOURCE_PROHIBITED = 'Supplied Service Rules - Prohibited Actions';
const SOURCE_ALLOWED = 'Supplied Service Rules - Allowed Actions';

/** Join items as 'a, b and c' for natural customer-facing lists. */
function joinNice(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Build the deterministic customer-facing message for a decision.
 * Used directly in fallback mode and as the phrasing source for the LLM.
 */
function buildDeterministicReply(options: {
  intent: string;
  customerName: string | null;
  decision: PolicyDecision;
  booking: Booking | null;
  actions: OrchestratorAction[];
  escalation: EscalationResult | null;
  /** True when a waiver mention lacks a parsable amount (adds a clarifying ask). */
  waiverClarification?: boolean;
  /** True when the message also asks for an upgrade/cabin change (refund/rebook turns). */
  upgradeMentioned?: boolean;
}): string {
  const { decision, actions, escalation, booking } = options;
  const name = options.customerName ?? 'there';
  const lines: string[] = [];

  if (escalation) {
    // Report anything already arranged before handing off to a human.
    const completed = actions.filter((a) => a.status === 'completed');
    if (completed.length > 0) {
      const granted: string[] = [];
      for (const action of completed) {
        if (action.action === 'issue_meal_voucher') granted.push('a meal voucher');
        if (action.action === 'issue_lounge_access') granted.push('lounge access');
        if (action.action === 'arrange_delayed_hours_hotel') {
          granted.push('hotel accommodation for the delayed hours only');
        }
      }
      if (granted.length > 0) {
        lines.push(`I've arranged ${joinNice(granted)}, ${name}.`);
      }
      if (completed.some((a) => a.action === 'arrange_delayed_hours_hotel')) {
        lines.push(
          'The hotel covers the delayed hours only — a full-night stay isn\'t something I can authorize.'
        );
      }
    }
    lines.push(
      `I'm not able to handle the rest of this request myself — I've escalated it to a human colleague (${escalation.priority} priority): ${escalation.reason}`
    );
    return lines.join(' ');
  }

  switch (options.intent) {
    case 'refund_request': {
      const refund = actions.find((a) => a.action === 'initiate_refund');
      if (refund?.status === 'completed') {
        lines.push(
          `I've initiated your full refund, ${name}.`,
          'It will be processed to your original payment method within 7 business days.'
        );
        if (options.upgradeMentioned) {
          lines.push(
            "A free upgrade isn't something I can approve — a voluntary higher-fare flight requires paying the fare difference."
          );
        }
      } else if (decision.status === 'escalation_required') {
        lines.push(
          `Refunds can only go to the original payment method, ${name}.`,
          'I\'ve escalated your request for supervisor review.'
        );
      } else {
        lines.push(decision.explanation);
      }
      break;
    }

    case 'rebooking_request': {
      const rebook = actions.find((a) => a.action === 'request_rebooking');
      if (rebook?.status === 'completed') {
        lines.push(
          `You're set for free rebooking, ${name}.`,
          'You can be rebooked on the next available flight at no charge within 24 hours.'
        );
        if (options.upgradeMentioned) {
          lines.push(
            "A free upgrade isn't something I can approve — a voluntary higher-fare flight requires paying the fare difference."
          );
        }
      } else {
        lines.push(decision.explanation);
      }
      break;
    }

    case 'meal_voucher_request':
    case 'lounge_request':
    case 'hotel_request':
    case 'delay_compensation': {
      const completed = actions.filter((a) => a.status === 'completed');
      const hotelGranted = completed.some(
        (a) => a.action === 'arrange_delayed_hours_hotel'
      );
      const loungeGranted = completed.some(
        (a) => a.action === 'issue_lounge_access'
      );
      if (completed.length > 0) {
        const granted: string[] = [];
        for (const action of completed) {
          if (action.action === 'issue_meal_voucher') granted.push('a meal voucher');
          if (action.action === 'issue_lounge_access') granted.push('lounge access');
          if (action.action === 'arrange_delayed_hours_hotel') {
            granted.push('hotel accommodation for the delayed hours only');
          }
        }
        lines.push(
          `I'm sorry for the disruption, ${name}. I've arranged ${joinNice(granted)}.`
        );
        // Scope note only when a hotel was actually arranged — never imply
        // a hotel exists when the request was refused.
        if (hotelGranted) {
          lines.push(
            'Please note the hotel covers the delayed hours only — a full-night stay isn\'t something I can authorize.'
          );
        }
      } else if (decision.status === 'clarification_required') {
        lines.push(
          `Delay remedies apply to delayed bookings, ${name} — this booking isn't currently delayed. Is there something else I can help with?`
        );
      } else {
        lines.push(decision.explanation);
      }
      // Explicit refusal for the specifically-requested remedy when denied,
      // with the exact policy threshold so the customer knows why.
      if (
        options.intent === 'hotel_request' &&
        !hotelGranted &&
        decision.ineligibleActions.includes('arrange_delayed_hours_hotel')
      ) {
        lines.push(
          `A hotel isn't available for this delay, ${name} — hotel accommodation applies only to delays of more than 5 hours.`
        );
      }
      if (
        options.intent === 'lounge_request' &&
        !loungeGranted &&
        decision.ineligibleActions.includes('issue_lounge_access')
      ) {
        lines.push(
          `Lounge access isn't available for this delay, ${name} — it applies only to delays of more than 3 hours.`
        );
      }
      break;
    }

    case 'upgrade_request': {
      lines.push(
        `I'm sorry, ${name} — upgrades aren't covered by our policy.`,
        'A voluntary higher-fare flight would require paying the fare difference.'
      );
      break;
    }

    case 'fare_difference_request': {
      if (decision.status === 'escalation_required') {
        lines.push(
          `A fare-difference waiver above ₹1,500 needs supervisor approval, ${name}.`,
          'I\'ve escalated your request.'
        );
      } else if (decision.eligibleActions.includes('waive_fare_difference')) {
        lines.push(`Good news, ${name} — I can waive the fare difference for you.`);
      } else if (decision.status === 'clarification_required') {
        lines.push(
          decision.explanation,
          "Could you tell me the amount you'd like waived?"
        );
      } else {
        lines.push(decision.explanation);
      }
      break;
    }

    case 'flight_status': {
      if (booking) {
        lines.push(
          `Here's the latest on your booking, ${name}: ${booking.flight} ${booking.route.from} → ${booking.route.to} on ${booking.date} is ${booking.status.toLowerCase()}.`
        );
        if (booking.status === 'Delayed') {
          lines.push(`New departure time: ${booking.newDeparture}.`);
        }
        if (booking.status === 'Cancelled') {
          lines.push(
            'You can be rebooked free of charge within 24 hours, or receive a full refund — just let me know.'
          );
        }
      } else {
        lines.push(
          `I couldn't find an active booking for that reference, ${name}. Could you double-check it?`
        );
      }
      break;
    }

    case 'cancellation_support': {
      lines.push(
        `I'm sorry about the cancellation, ${name}.`,
        'Because this was an airline-caused cancellation, you can choose free rebooking on the next available flight within 24 hours, or a full refund to your original payment method.'
      );
      break;
    }

    case 'legal_complaint': {
      lines.push(
        `I understand this is frustrating, ${name}.`,
        'Legal matters need to be handled by a human colleague — I\'ve escalated this right away.'
      );
      break;
    }

    case 'unknown':
    default: {
      lines.push(
        decision.explanation ||
          `I'm not sure I understood that, ${name}. Could you tell me more about what you need help with?`
      );
      break;
    }
  }

  if (options.waiverClarification) {
    lines.push(
      "Also, regarding waiving the fare difference: could you tell me the amount you're asking to waive?"
    );
  }

  return lines.join(' ');
}

// ---------------------------------------------------------------------------
// Per-intent policy pipelines (deterministic)
// ---------------------------------------------------------------------------

interface PipelineOutcome {
  decision: PolicyDecision;
  policyUsed: string[];
  actions: OrchestratorAction[];
  escalation: EscalationResult | null;
}

function toAction(action: ReturnType<typeof executeAction>): OrchestratorAction {
  return {
    id: action.id,
    action: action.action,
    status: action.status,
    reason: action.reason,
    timestamp: action.timestamp,
  };
}

/**
 * Delay remedies pipeline: executes every entitled remedy (meal voucher,
 * lounge access, delayed-hours hotel) for a delayed booking.
 *
 * `requestedRemedy` is the specific remedy the customer named (derived from
 * their intent). When it is NOT entitled, it is reported in
 * `ineligibleActions` (and the status becomes `partially_eligible` if other
 * remedies were still granted) so callers — and the frontend's
 * "Rejected requests" panel — can show an explicit refusal instead of
 * silently dropping the ask.
 */
function runDelayPipeline(
  booking: Booking,
  requestedRemedy:
    | 'issue_meal_voucher'
    | 'issue_lounge_access'
    | 'arrange_delayed_hours_hotel'
    | null
): PipelineOutcome {
  const actions: OrchestratorAction[] = [];

  if (booking.status !== 'Delayed') {
    return {
      decision: {
        status: 'clarification_required',
        eligibleActions: [],
        ineligibleActions: [],
        requiresEscalation: false,
        escalationReason: null,
        policySources: [SOURCE_DELAY],
        explanation:
          'Delay remedies apply to delayed bookings; this booking is not delayed.',
      },
      policyUsed: [SOURCE_DELAY],
      actions,
      escalation: null,
    };
  }

  const comp = calculateDelayCompensation(booking.delayHours);

  const remedies: Array<{
    action: 'issue_meal_voucher' | 'issue_lounge_access' | 'arrange_delayed_hours_hotel';
    entitled: boolean;
    reason: string;
  }> = [
    {
      action: 'issue_meal_voucher',
      entitled: comp.mealVoucher,
      reason: 'Meal voucher entitlement for the delay.',
    },
    {
      action: 'issue_lounge_access',
      entitled: comp.loungeAccess,
      reason: 'Lounge access entitlement (delay exceeds 3 hours).',
    },
    {
      action: 'arrange_delayed_hours_hotel',
      entitled: comp.hotelForDelayedHours,
      reason: 'Hotel entitlement (delay exceeds 5 hours, delayed hours only).',
    },
  ];

  for (const remedy of remedies) {
    if (!remedy.entitled) continue; // not entitled: never attempt execution
    actions.push(
      toAction(
        executeAction({
          pnr: booking.pnr,
          action: remedy.action,
          reason: remedy.reason,
        })
      )
    );
  }

  const eligibleActions: PolicyDecision['eligibleActions'] = [];
  if (comp.mealVoucher) eligibleActions.push('issue_meal_voucher');
  if (comp.loungeAccess) eligibleActions.push('issue_lounge_access');
  if (comp.hotelForDelayedHours) eligibleActions.push('arrange_delayed_hours_hotel');

  // Was the specifically-requested remedy refused? Say so explicitly.
  const entitled: Record<string, boolean> = {
    issue_meal_voucher: comp.mealVoucher,
    issue_lounge_access: comp.loungeAccess,
    arrange_delayed_hours_hotel: comp.hotelForDelayedHours,
  };
  const refused =
    requestedRemedy !== null && !entitled[requestedRemedy]
      ? requestedRemedy
      : null;
  const ineligibleActions: PolicyDecision['ineligibleActions'] = refused
    ? [refused]
    : [];

  let explanation = comp.hotelForDelayedHours
    ? 'Delay exceeds 5 hours: meal voucher, lounge access, and hotel for the delayed hours only.'
    : comp.loungeAccess
      ? 'Delay exceeds 3 hours: meal voucher and lounge access.'
      : 'Delay entitles the customer to a meal voucher.';
  if (refused === 'arrange_delayed_hours_hotel') {
    explanation +=
      ' Hotel accommodation was refused: it applies only to delays of more than 5 hours.';
  } else if (refused === 'issue_lounge_access') {
    explanation +=
      ' Lounge access was refused: it applies only to delays of more than 3 hours.';
  } else if (refused === 'issue_meal_voucher') {
    explanation += ' No meal-voucher entitlement for this delay length.';
  }

  return {
    decision: {
      status:
        eligibleActions.length > 0
          ? ineligibleActions.length > 0
            ? 'partially_eligible'
            : 'eligible'
          : 'ineligible',
      eligibleActions,
      ineligibleActions,
      requiresEscalation: false,
      escalationReason: null,
      policySources: [SOURCE_DELAY],
      explanation,
    },
    policyUsed: [SOURCE_DELAY],
    actions,
    escalation: null,
  };
}

/**
 * The specific delay remedy a delay-family intent names, if any.
 * `delay_compensation` is a general ask, so it maps to no single remedy.
 */
function requestedRemedyForIntent(
  intent: string
):
  | 'issue_meal_voucher'
  | 'issue_lounge_access'
  | 'arrange_delayed_hours_hotel'
  | null {
  switch (intent) {
    case 'meal_voucher_request':
      return 'issue_meal_voucher';
    case 'lounge_request':
      return 'issue_lounge_access';
    case 'hotel_request':
      return 'arrange_delayed_hours_hotel';
    default:
      return null;
  }
}

/** Refund pipeline: airline-caused cancellation + original payment method only. */
function runRefundPipeline(
  booking: Booking | null,
  entities: { paymentMethod?: string }
): PipelineOutcome {
  // Prohibited: refund to a different payment method → escalation.
  if (entities.paymentMethod === 'different') {
    return {
      decision: {
        status: 'escalation_required',
        eligibleActions: [],
        ineligibleActions: ['initiate_refund'],
        requiresEscalation: true,
        escalationReason:
          'Refund to a payment method other than the original is prohibited; supervisor review required.',
        policySources: [SOURCE_REFUND, SOURCE_PROHIBITED],
        explanation: 'Refunds must go to the original payment method only.',
      },
      policyUsed: [SOURCE_REFUND, SOURCE_PROHIBITED],
      actions: [],
      escalation: escalate('refund_different_payment_method'),
    };
  }

  if (!booking || booking.status !== 'Cancelled') {
    return {
      decision: {
        status: 'clarification_required',
        eligibleActions: [],
        ineligibleActions: ['initiate_refund'],
        requiresEscalation: false,
        escalationReason: null,
        policySources: [SOURCE_REFUND],
        explanation:
          'Refunds apply to cancelled bookings; this booking is not cancelled.',
      },
      policyUsed: [SOURCE_REFUND],
      actions: [],
      escalation: null,
    };
  }

  const airlineCaused =
    booking.cancellationReason.toLowerCase() === 'operational reasons';

  if (!airlineCaused) {
    return {
      decision: {
        status: 'ineligible',
        eligibleActions: [],
        ineligibleActions: ['initiate_refund'],
        requiresEscalation: false,
        escalationReason: null,
        policySources: [SOURCE_CANCELLATION],
        explanation:
          'Refund requires an airline-caused cancellation; this cause does not qualify.',
      },
      policyUsed: [SOURCE_CANCELLATION],
      actions: [],
      escalation: null,
    };
  }

  const action = toAction(
    executeAction({
      pnr: booking.pnr,
      action: 'initiate_refund',
      reason: 'Airline-caused cancellation: full refund to original payment method.',
    })
  );

  return {
    decision: {
      status: 'eligible',
      eligibleActions: ['initiate_refund'],
      ineligibleActions: [],
      requiresEscalation: false,
      escalationReason: null,
      policySources: [SOURCE_CANCELLATION, SOURCE_REFUND],
      explanation: 'Full refund to the original payment method within 7 business days.',
    },
    policyUsed: [SOURCE_CANCELLATION, SOURCE_REFUND],
    actions: [action],
    escalation: null,
  };
}

/** Rebooking pipeline: airline-caused cancellation → free rebooking within 24h. */
function runRebookingPipeline(booking: Booking | null): PipelineOutcome {
  if (!booking || booking.status !== 'Cancelled') {
    return {
      decision: {
        status: 'clarification_required',
        eligibleActions: [],
        ineligibleActions: ['rebook_within_24_hours'],
        requiresEscalation: false,
        escalationReason: null,
        policySources: [SOURCE_CANCELLATION],
        explanation:
          'Rebooking remedies apply to cancelled bookings; this booking is not cancelled.',
      },
      policyUsed: [SOURCE_CANCELLATION],
      actions: [],
      escalation: null,
    };
  }

  const airlineCaused =
    booking.cancellationReason.toLowerCase() === 'operational reasons';

  if (!airlineCaused) {
    return {
      decision: {
        status: 'ineligible',
        eligibleActions: [],
        ineligibleActions: ['rebook_within_24_hours'],
        requiresEscalation: false,
        escalationReason: null,
        policySources: [SOURCE_CANCELLATION],
        explanation: 'Non-airline-caused disruptions allow no exceptions.',
      },
      policyUsed: [SOURCE_CANCELLATION],
      actions: [],
      escalation: null,
    };
  }

  const action = toAction(
    executeAction({
      pnr: booking.pnr,
      action: 'request_rebooking',
      reason: 'Airline-caused cancellation: free rebooking within 24 hours.',
    })
  );

  return {
    decision: {
      status: 'eligible',
      eligibleActions: ['rebook_within_24_hours'],
      ineligibleActions: [],
      requiresEscalation: false,
      escalationReason: null,
      policySources: [SOURCE_CANCELLATION],
      explanation: 'Free rebooking on the next available flight within 24 hours.',
    },
    policyUsed: [SOURCE_CANCELLATION],
    actions: [action],
    escalation: null,
  };
}

/** Fare-difference/waiver pipeline with escalation above ₹1,500. */
function runFareDifferencePipeline(
  entities: { waiverAmountInr?: number },
  pnr: string | undefined
): PipelineOutcome {
  // No amount -> never guess. Ask for the amount; nothing is granted.
  if (entities.waiverAmountInr === undefined) {
    return {
      decision: {
        status: 'clarification_required',
        eligibleActions: [],
        ineligibleActions: [],
        requiresEscalation: false,
        escalationReason: null,
        policySources: [SOURCE_FARE],
        explanation:
          'Waiver requested without an amount; the customer must specify how much of the fare difference they want waived.',
      },
      policyUsed: [SOURCE_FARE],
      actions: [],
      escalation: null,
    };
  }
  const requestedWaiver = entities.waiverAmountInr;
  // No fare difference is known from booking data; the waiver request itself
  // drives the decision (waiver must not exceed the difference).
  const fareDecision = evaluateFareDifference(requestedWaiver, requestedWaiver);

  const escalation =
    fareDecision.status === 'escalation_required'
      ? escalate('fare_waiver_above_limit', pnr ? { pnr } : undefined)
      : null;

  return {
    decision: {
      status: fareDecision.status,
      eligibleActions: [...fareDecision.eligibleActions],
      ineligibleActions: [...fareDecision.ineligibleActions],
      requiresEscalation: fareDecision.requiresEscalation,
      escalationReason: fareDecision.escalationReason,
      policySources: [SOURCE_FARE],
      explanation: fareDecision.explanation,
    },
    policyUsed: [SOURCE_FARE],
    actions: [],
    escalation,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Handle one customer chat turn end-to-end.
 * Always succeeds with a structured result; business failures appear in
 * decision.status / escalation, not exceptions.
 */
export async function handleChatMessage(options: {
  message: string;
  pnr?: string;
  /** Previous turns for LLM tone continuity. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<OrchestratorResult> {
  const message = options.message.trim();
  const explicitPnr = options.pnr?.trim().toUpperCase() || undefined;

  // 1. Detect intent + entities once.
  const intentResult = detectIntent(message);
  const intent = intentResult.intent;

  // 2. Identify customer: explicit PNR wins over message-embedded PNR.
  const effectivePnr = explicitPnr ?? intentResult.entities.pnr;
  const customer = effectivePnr ? getCustomerByPnr(effectivePnr) ?? null : null;
  const bookings = customer ? getBookingsByPnr(customer.pnr) : [];
  const booking: Booking | null =
    getPrimaryDisruptedBooking(customer?.pnr ?? '') ?? bookings[0] ?? null;

  // --- Missing PNR: clarification, no policy run --------------------------
  if (!effectivePnr) {
    const decision: PolicyDecision = {
      status: 'clarification_required',
      eligibleActions: [],
      ineligibleActions: [],
      requiresEscalation: false,
      escalationReason: null,
      policySources: [],
      explanation: 'PNR is required to process the request.',
    };
    const fallbackText =
      'Could you share your booking reference (PNR) so I can look into this?';
    const llm = await phraseDecision({
      fallbackText,
      decisionSummary: 'Customer did not provide a PNR; ask for it politely.',
      history: options.history,
    });
    const audit = createAuditRecord({
      pnr: 'UNKNOWN',
      customer: 'Unknown',
      intent,
      policyUsed: [],
      decision: 'Clarification required: PNR missing.',
      actions: [],
      escalation: null,
    });

    return {
      message: llm.used ? (llm.text ?? fallbackText) : fallbackText,
      intent,
      customer: null,
      booking: null,
      policyUsed: [],
      decision,
      actions: [],
      escalation: null,
      auditId: audit.id,
      llmUsed: llm.used,
    };
  }

  // --- Unknown PNR: clarification, no policy run --------------------------
  if (!customer) {
    const decision: PolicyDecision = {
      status: 'clarification_required',
      eligibleActions: [],
      ineligibleActions: [],
      requiresEscalation: false,
      escalationReason: null,
      policySources: [],
      explanation: 'No customer found for the provided PNR.',
    };
    const fallbackText = `I couldn't find a booking for reference ${effectivePnr}. Could you double-check it?`;
    const llm = await phraseDecision({
      fallbackText,
      decisionSummary: 'PNR not found in records; ask the customer to re-check.',
      history: options.history,
    });
    const audit = createAuditRecord({
      pnr: effectivePnr,
      customer: 'Unknown',
      intent,
      policyUsed: [],
      decision: 'Clarification required: unknown PNR.',
      actions: [],
      escalation: null,
    });

    return {
      message: llm.used ? (llm.text ?? fallbackText) : fallbackText,
      intent,
      customer: null,
      booking: null,
      policyUsed: [],
      decision,
      actions: [],
      escalation: null,
      auditId: audit.id,
      llmUsed: llm.used,
    };
  }

  // --- Known customer: run the per-intent deterministic pipeline ----------
  let outcome: PipelineOutcome;
  switch (intent) {
    case 'refund_request':
      outcome = runRefundPipeline(booking, intentResult.entities);
      break;
    case 'rebooking_request':
      outcome = runRebookingPipeline(booking);
      break;
    case 'meal_voucher_request':
    case 'lounge_request':
    case 'hotel_request':
    case 'delay_compensation':
      outcome = runDelayPipeline(booking, requestedRemedyForIntent(intent));
      break;
    case 'fare_difference_request':
      outcome = runFareDifferencePipeline(intentResult.entities, customer.pnr);
      break;
    case 'upgrade_request':
      outcome = {
        decision: {
          status: 'ineligible',
          eligibleActions: [],
          ineligibleActions: [],
          requiresEscalation: false,
          escalationReason: null,
          policySources: [SOURCE_FARE],
          explanation:
            'Upgrades are not covered by policy; a voluntary higher-fare flight requires paying the fare difference.',
        },
        policyUsed: [SOURCE_FARE],
        actions: [],
        escalation: null,
      };
      break;
    case 'flight_status':
      outcome = {
        decision: {
          status: 'eligible',
          eligibleActions: ['provide_booking_status'],
          ineligibleActions: [],
          requiresEscalation: false,
          escalationReason: null,
          policySources: [SOURCE_ALLOWED],
          explanation: 'Provided the current booking status.',
        },
        policyUsed: [SOURCE_ALLOWED],
        actions: [],
        escalation: null,
      };
      break;
    case 'legal_complaint': {
      const escalationResult = escalate('legal_threat', { pnr: customer.pnr });
      outcome = {
        decision: {
          status: 'escalation_required',
          eligibleActions: [],
          ineligibleActions: [],
          requiresEscalation: true,
          escalationReason: escalationResult.reason,
          policySources: [SOURCE_PROHIBITED],
          explanation: 'Legal matters are handled by human colleagues.',
        },
        policyUsed: [SOURCE_PROHIBITED],
        actions: [],
        escalation: escalationResult,
      };
      break;
    }
    case 'cancellation_support':
      outcome = {
        decision: {
          status: 'eligible',
          eligibleActions: ['initiate_refund', 'rebook_within_24_hours'],
          ineligibleActions: [],
          requiresEscalation: false,
          escalationReason: null,
          policySources: [SOURCE_CANCELLATION],
          explanation:
            'Airline-caused cancellation: free rebooking within 24 hours or a full refund.',
        },
        policyUsed: [SOURCE_CANCELLATION],
        actions: [],
        escalation: null,
      };
      break;
    case 'unknown':
    default:
      outcome = {
        decision: {
          status: 'clarification_required',
          eligibleActions: [],
          ineligibleActions: [],
          requiresEscalation: false,
          escalationReason: null,
          policySources: [],
          explanation:
            'Request could not be classified; asking the customer for clarification.',
        },
        policyUsed: [],
        actions: [],
        escalation: null,
      };
      break;
  }

  // 3. Loyalty context: priority rebooking for Gold/Platinum adds a source.
  const loyalty = evaluateLoyaltyBenefits(customer);
  if (
    loyalty.eligibleActions.includes('priority_rebooking') &&
    outcome.decision.eligibleActions.includes('rebook_within_24_hours')
  ) {
    outcome.decision = {
      ...outcome.decision,
      policySources: [...new Set([...outcome.decision.policySources, SOURCE_LOYALTY])],
    };
    outcome.policyUsed = outcome.decision.policySources;
  }

  // 3b. Combined asks: a fare waiver above ₹1,500 escalates even when
  // delay remedies were already executed in the same turn. Merge it in.
  // A waiver mention without a parsable amount is never ignored: it routes to
  // fare-difference handling for a clarifying question (never silent, never
  // an unauthorized grant).
  if (
    intent !== 'fare_difference_request' &&
    WAIVER_ASK.test(message) &&
    intentResult.entities.waiverAmountInr === undefined
  ) {
    const waivedOutcome = runFareDifferencePipeline(
      intentResult.entities,
      customer.pnr
    );
    outcome.decision = waivedOutcome.decision;
    outcome.policyUsed = [...new Set([...outcome.policyUsed, ...waivedOutcome.policyUsed])];
    outcome.escalation = waivedOutcome.escalation;
  } else if (
    intent !== 'fare_difference_request' &&
    intentResult.entities.waiverAmountInr !== undefined &&
    intentResult.entities.waiverAmountInr > ENGINE_RULES.maxWaiverWithoutApprovalInr
  ) {
    const waiverEscalation = escalate('fare_waiver_above_limit', { pnr: customer.pnr });
    outcome.escalation = waiverEscalation;
    outcome.decision = {
      ...outcome.decision,
      status: 'escalation_required',
      requiresEscalation: true,
      escalationReason: waiverEscalation.reason,
      policySources: [...new Set([...outcome.decision.policySources, SOURCE_FARE])],
    };
    outcome.policyUsed = [...new Set([...outcome.policyUsed, SOURCE_FARE])];
  }

  // 4. Response generation: LLM phrasing when available, deterministic otherwise.
  const waiverClarification =
    intent !== 'fare_difference_request' &&
    WAIVER_ASK.test(message) &&
    intentResult.entities.waiverAmountInr === undefined;
  const upgradeMentioned =
    (intent === 'refund_request' || intent === 'rebooking_request') &&
    /\bupgrade\b|\bbusiness[-\s]?class\b|\bfirst[-\s]?class\b|\bpremium\b/i.test(
      message
    );
  const fallbackText = buildDeterministicReply({
    intent,
    customerName: customer.name,
    decision: outcome.decision,
    booking,
    actions: outcome.actions,
    escalation: outcome.escalation,
    waiverClarification,
    upgradeMentioned,
  });

  const llm = await phraseDecision({
    fallbackText,
    decisionSummary: JSON.stringify(
      {
        intent,
        status: outcome.decision.status,
        eligibleActions: outcome.decision.eligibleActions,
        ineligibleActions: outcome.decision.ineligibleActions,
        requiresEscalation: outcome.decision.requiresEscalation,
        escalationReason: outcome.decision.escalationReason,
        explanation: outcome.decision.explanation,
        delayHours: booking?.status === 'Delayed' ? booking.delayHours : undefined,
        customerTier: customer.loyaltyTier,
      },
      null,
      2
    ),
    history: options.history,
  });

  // 5. Audit record.
  const audit = createAuditRecord({
    pnr: customer.pnr,
    customer: customer.name,
    intent,
    policyUsed: outcome.policyUsed,
    decision: `[${outcome.decision.status}] ${outcome.decision.explanation}`,
    actions: outcome.actions.map((action) => ({
      action: action.action,
      status: action.status,
    })),
    escalation: outcome.escalation,
  });

  return {
    message: llm.used ? (llm.text ?? fallbackText) : fallbackText,
    intent,
    customer,
    booking,
    policyUsed: outcome.policyUsed,
    decision: outcome.decision,
    actions: outcome.actions,
    escalation: outcome.escalation,
    auditId: audit.id,
    llmUsed: llm.used,
  };
}

/** Agent meta payload (GET /api/agent). */
export function getAgentInfo() {
  return {
    agent: 'airline-resolution-agent',
    version: '1.0.0',
    llm: {
      provider: 'groq',
      available: isLlmAvailable(),
      model: env.groqModel,
    },
    endpoints: {
      chat: 'POST /api/agent/chat',
    },
  };
}
