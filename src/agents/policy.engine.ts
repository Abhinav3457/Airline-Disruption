/**
 * DETERMINISTIC POLICY ENGINE.
 * The single source of truth for what the airline resolution agent may offer.
 * Decisions come only from the supplied rules — an LLM may phrase outcomes
 * later, but must never decide eligibility. No data is invented here.
 *
 * Boundary semantics (from the exact rule text):
 *   'under 3 hours'      -> delayHours <  3
 *   'more than 3 hours'  -> delayHours >  3   (exactly 3 is NOT 'more than 3')
 *   'more than 5 hours'  -> delayHours >  5   (exactly 5 is NOT 'more than 5')
 *   waiver <= ₹1,500     -> agent may grant (exactly 1,500 is not 'above')
 *   waiver >  ₹1,500     -> supervisor approval required
 */

import type {
  ActionContext,
  CancellationRequest,
  DecisionActionId,
  DecisionStatus,
  DelayActionEvaluation,
  DelayRequestAction,
  EngineActionId,
  EscalationContext,
  EscalationRequest,
  PolicyDecision,
} from '../types';

import {
  getAllowedActions,
  getFareDifferencePolicy,
} from '../services/policy.service';

import { getPolicies } from '../data/store';

import type {
  Booking,
  CancelledBooking,
  Customer,
  DelayedBooking,
  LoyaltyPolicy,
  PolicyDocument,
} from '../types';

// ---------------------------------------------------------------------------
// Engine constants (derived from the supplied policy, not invented)
// ---------------------------------------------------------------------------

export const ENGINE_RULES = {
  /** Free rebooking window after an airline-caused cancellation (hours). */
  rebookingWindowHours: 24,
  /** Waiver ceiling the agent may grant without supervisor approval (INR). */
  maxWaiverWithoutApprovalInr: 1500,
  /** Delay tier thresholds in hours. */
  delayTier1MaxHours: 3,
  delayTier2MoreThanHours: 3,
  delayTier3MoreThanHours: 5,
} as const;

const SOURCE_CANCELLATION =
  'Supplied Service Rules - Cancellation Rule' as const;
const SOURCE_DELAY = 'Supplied Service Rules - Delay Compensation Rule' as const;
const SOURCE_REFUND = 'Supplied Service Rules - Refund Rule' as const;
const SOURCE_FARE = 'Supplied Service Rules - Fare Difference Rule' as const;
const SOURCE_LOYALTY = 'Supplied Service Rules - Loyalty Rule' as const;
const SOURCE_ACTIONS = 'Supplied Service Rules - Allowed Actions' as const;
const SOURCE_PROHIBITED =
  'Supplied Service Rules - Prohibited Actions' as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a PolicyDecision with sensible defaults for omitted fields.
 * Generic so callers can attach extra read-only fields (e.g. rebookingWindowHours)
 * without losing type information.
 */
function decision<T extends object = Record<string, never>>(
  input: {
    status: DecisionStatus;
    eligibleActions?: DecisionActionId[];
    ineligibleActions?: DecisionActionId[];
    requiresEscalation?: boolean;
    escalationReason?: string | null;
    policySources: string[];
    explanation: string;
  } & T
): PolicyDecision & T {
  const defaults = {
    eligibleActions: [],
    ineligibleActions: [],
    requiresEscalation: false,
    escalationReason: null,
  } as const;

  return { ...defaults, ...input } as PolicyDecision & T;
}

/** The loyalty entitlements a tier unlocks under the supplied rules. */
function loyaltyBenefits(tier: Customer['loyaltyTier'], policy: LoyaltyPolicy): {
  priorityRebooking: boolean;
  extraCompensation: boolean;
} {
  const priorityRebooking = policy.priorityRebookingTiers.includes(tier);
  return {
    priorityRebooking,
    // Supplied rule: 'No additional compensation beyond standard policy' for
    // every tier — loyalty unlocks scheduling priority, not richer payouts.
    extraCompensation: false,
  };
}

// ---------------------------------------------------------------------------
// 1. Cancellation
// ---------------------------------------------------------------------------

/**
 * Airline-caused cancellation: free rebooking within 24 hours OR full refund.
 * Non-airline causes are prohibited from exceptions entirely.
 * `rebookingDeadline` is returned so callers never have to invent flight
 * details themselves; the engine does not pick a specific next flight.
 */
export function evaluateCancellation(
  booking: Booking,
  customerRequest: CancellationRequest
): PolicyDecision & { rebookingWindowHours: number } {
  const base = {
    policySources: [SOURCE_CANCELLATION],
    rebookingWindowHours: ENGINE_RULES.rebookingWindowHours,
  };

  const isCancelled = booking.status === 'Cancelled';
  const airlineCaused =
    booking.status === 'Cancelled' &&
    booking.cancellationReason.toLowerCase() === 'operational reasons';

  if (!isCancelled || !airlineCaused) {
    return decision({
      ...base,
      status: 'ineligible',
      eligibleActions: [],
      ineligibleActions: ['rebook_within_24_hours', 'initiate_refund'],
      explanation: !isCancelled
        ? 'Booking is not cancelled; cancellation policy does not apply.'
        : 'Cancellation cause is not airline-caused, so no exception is permitted.',
    });
  }

  if (customerRequest === 'rebook') {
    return decision({
      ...base,
      status: 'eligible',
      eligibleActions: ['rebook_within_24_hours'],
      ineligibleActions: [],
      explanation:
        'Airline-caused cancellation: customer may be rebooked free of charge within 24 hours.',
    });
  }

  return decision({
    ...base,
    status: 'eligible',
    eligibleActions: ['initiate_refund'],
    ineligibleActions: [],
    explanation:
      'Airline-caused cancellation: customer is eligible for a full refund.',
  });
}

// ---------------------------------------------------------------------------
// 2. Delay compensation calculator
// ---------------------------------------------------------------------------

/**
 * Entitlements for a given delay length, straight from the supplied bands:
 *   <3h: ₹500 meal voucher
 *   >3h: meal voucher + lounge access
 *   >5h: meal voucher + lounge access + hotel (delayed hours only)
 */
export function calculateDelayCompensation(delayHours: number): {
  mealVoucher: boolean;
  loungeAccess: boolean;
  hotelForDelayedHours: boolean;
  policySources: string[];
} {
  if (!Number.isFinite(delayHours) || delayHours < 0) {
    throw new RangeError('delayHours must be a non-negative finite number');
  }

  // Cumulative bands: entitlements never decrease as the delay grows.
  // A meal voucher covers any delay (the tier-1 band runs up to and including
  // 3 hours); lounge starts strictly above 3 hours; hotel strictly above 5.
  // Exactly 3 is NOT 'more than 3'; exactly 5 is NOT 'more than 5'.
  const mealVoucher = delayHours > 0;
  const loungeAccess = delayHours > ENGINE_RULES.delayTier2MoreThanHours;
  const hotelForDelayedHours = delayHours > ENGINE_RULES.delayTier3MoreThanHours;

  return {
    mealVoucher,
    loungeAccess,
    hotelForDelayedHours,
    policySources: [SOURCE_DELAY],
  };
}

// ---------------------------------------------------------------------------
// 3. Delay request evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a requested action against a delayed booking.
 * Hotel is granted only for delays strictly greater than 5 hours, and only
 * for the delayed hours — full-night stays are never authorized.
 */
export function evaluateDelayRequest(
  booking: Booking,
  requestedAction: DelayRequestAction
): PolicyDecision {
  const base = { policySources: [SOURCE_DELAY] };

  if (booking.status !== 'Delayed') {
    return decision({
      ...base,
      status: 'clarification_required',
      eligibleActions: [],
      ineligibleActions: [requestedAction],
      explanation:
        'Requested action applies to delayed bookings; this booking is not delayed.',
    });
  }

  const delayed = booking as DelayedBooking;
  const comp = calculateDelayCompensation(delayed.delayHours);

  const evaluationFor = (action: DelayRequestAction): DelayActionEvaluation => {
    switch (action) {
      case 'issue_meal_voucher':
        return {
          action,
          granted: comp.mealVoucher,
          reason: comp.mealVoucher
            ? 'Delays carry a meal-voucher entitlement.'
            : 'No meal-voucher entitlement for this delay length.',
        };
      case 'issue_lounge_access':
        return {
          action,
          granted: comp.loungeAccess,
          reason: comp.loungeAccess
            ? 'Delay exceeds 3 hours: lounge access included.'
            : 'Lounge access requires a delay of more than 3 hours.',
        };
      case 'arrange_delayed_hours_hotel':
        return {
          action,
          granted: comp.hotelForDelayedHours,
          reason: comp.hotelForDelayedHours
            ? 'Delay exceeds 5 hours: hotel for the delayed hours only.'
            : 'Hotel applies only to delays of more than 5 hours, delayed hours only.',
        };
      case 'rebook_within_24_hours':
        return {
          action,
          granted: false,
          reason:
            'Rebooking is a cancellation remedy, not a delay remedy, under supplied policy.',
        };
    }
  };

  const evaluation = evaluationFor(requestedAction);

  return decision({
    ...base,
    status: evaluation.granted ? 'eligible' : 'ineligible',
    eligibleActions: evaluation.granted ? [requestedAction] : [],
    ineligibleActions: evaluation.granted ? [] : [requestedAction],
    explanation: evaluation.reason,
  });
}

// ---------------------------------------------------------------------------
// 4. Refund evaluation
// ---------------------------------------------------------------------------

/**
 * Full refund, within 7 business days, original payment method only.
 * A non-original payment method is rejected and escalated: agents may never
 * redirect refunds under the supplied policy.
 */
export function evaluateRefundRequest(
  booking: Booking,
  requestedPaymentMethod: string
): PolicyDecision & { refundTimeframe: string } {
  const base = {
    policySources: [SOURCE_REFUND],
    refundTimeframe: 'Within 7 business days',
  };

  if (booking.status !== 'Cancelled') {
    return decision({
      ...base,
      status: 'clarification_required',
      eligibleActions: [],
      ineligibleActions: ['initiate_refund'],
      explanation:
        'Refund applies to cancelled bookings; this booking is not cancelled.',
    });
  }

  const cancelled = booking as CancelledBooking;
  const airlineCaused =
    cancelled.cancellationReason.toLowerCase() === 'operational reasons';

  const method = requestedPaymentMethod.trim().toLowerCase();
  const isOriginal = method === 'original';

  if (!airlineCaused) {
    return decision({
      ...base,
      status: 'ineligible',
      eligibleActions: [],
      ineligibleActions: ['initiate_refund'],
      explanation:
        'Refund requires an airline-caused cancellation; this cause does not qualify.',
    });
  }

  if (!isOriginal) {
    return decision({
      ...base,
      status: 'escalation_required',
      eligibleActions: [],
      ineligibleActions: ['initiate_refund'],
      requiresEscalation: true,
      escalationReason:
        'Refund to a payment method other than the original is prohibited; supervisor review required.',
      explanation:
        'Refund must go to the original payment method only; the requested method was different.',
    });
  }

  return decision({
    ...base,
    status: 'eligible',
    eligibleActions: ['initiate_refund'],
    ineligibleActions: [],
    explanation:
      'Full refund to the original payment method within 7 business days.',
  });
}

// ---------------------------------------------------------------------------
// 5. Fare difference
// ---------------------------------------------------------------------------

/**
 * Customer pays any fare difference on a voluntary higher-fare flight.
 * A waiver of exactly ₹1,500 may be granted (it is not 'above' ₹1,500);
 * anything above requires supervisor approval.
 */
export function evaluateFareDifference(
  fareDifference: number,
  requestedWaiver: number
): PolicyDecision {
  if (!Number.isFinite(fareDifference) || fareDifference < 0) {
    throw new RangeError('fareDifference must be a non-negative finite number');
  }
  if (!Number.isFinite(requestedWaiver) || requestedWaiver < 0) {
    throw new RangeError('requestedWaiver must be a non-negative finite number');
  }

  const policy = getFareDifferencePolicy().details;
  const limit = policy.maxWaiverWithoutApprovalInr; // 1500

  const base = { policySources: [SOURCE_FARE] };

  // Waiver larger than the difference is nonsensical — ask for clarity.
  if (requestedWaiver > fareDifference) {
    return decision({
      ...base,
      status: 'clarification_required',
      eligibleActions: [],
      ineligibleActions: ['waive_fare_difference'],
      explanation:
        'Requested waiver exceeds the fare difference; please confirm the amounts.',
    });
  }

  if (requestedWaiver <= 0) {
    return decision({
      ...base,
      status: 'eligible',
      eligibleActions: [],
      ineligibleActions: ['waive_fare_difference'],
      explanation:
        'No waiver requested: customer pays the fare difference of their higher-fare flight.',
    });
  }

  if (requestedWaiver <= limit) {
    return decision({
      ...base,
      status: 'eligible',
      eligibleActions: ['waive_fare_difference'],
      ineligibleActions: [],
      explanation: `Waiver of ₹${requestedWaiver} is within the ₹${limit} agent authority and may be granted.`,
    });
  }

  return decision({
    ...base,
    status: 'escalation_required',
    eligibleActions: [],
    ineligibleActions: ['waive_fare_difference'],
    requiresEscalation: true,
    escalationReason: `Waiver of ₹${requestedWaiver} exceeds the ₹${limit} agent limit; supervisor approval required.`,
    explanation: `Waiver of ₹${requestedWaiver} is above the ₹${limit} agent authority; escalate to a supervisor.`,
  });
}

// ---------------------------------------------------------------------------
// 6. Loyalty benefits
// ---------------------------------------------------------------------------

/**
 * Gold and Platinum receive priority rebooking only — no additional
 * compensation beyond standard policy for any tier.
 */
export function evaluateLoyaltyBenefits(customer: Customer): PolicyDecision {
  const loyalty = getPolicies().loyalty;
  const benefits = loyaltyBenefits(customer.loyaltyTier, loyalty);

  const eligibleActions: DecisionActionId[] = benefits.priorityRebooking
    ? ['priority_rebooking']
    : [];

  return decision({
    policySources: [SOURCE_LOYALTY],
    status: benefits.priorityRebooking ? 'eligible' : 'ineligible',
    eligibleActions,
    ineligibleActions: benefits.priorityRebooking ? [] : ['priority_rebooking'],
    explanation: benefits.priorityRebooking
      ? `${customer.loyaltyTier} tier: priority rebooking. No additional compensation beyond standard policy.`
      : `${customer.loyaltyTier} tier: standard handling; no additional compensation beyond standard policy.`,
  });
}

// ---------------------------------------------------------------------------
// 7. Action authorization gate
// ---------------------------------------------------------------------------

/**
 * Last line of defense before any action executes: re-checks the request
 * against the allowed/prohibited lists and the deterministic entitlements.
 * Returns false for anything the supplied policy does not explicitly allow.
 */
export function evaluateActionAuthorization(
  action: EngineActionId,
  context: ActionContext
): { authorized: boolean; reason: string; policySources: string[] } {
  const policies: PolicyDocument = getPolicies();
  const allowedIds = getAllowedActions().details.map((entry) => entry.id);
  const sources = [SOURCE_ACTIONS, SOURCE_PROHIBITED];

  const isDataLayerAction = (allowedIds as readonly string[]).includes(action);

  // Engine-only actions are governed by their own rules.
  const engineOnly: Record<string, boolean> = {
    priority_rebooking: true,
    waive_fare_difference: true,
  };
  if (!isDataLayerAction && !engineOnly[action]) {
    return {
      authorized: false,
      reason: 'Unknown action; only the six allowed actions may be executed.',
      policySources: sources,
    };
  }

  const { customer, booking } = context;

  switch (action) {
    case 'provide_booking_status':
      return { authorized: true, reason: 'Providing booking status is always allowed.', policySources: sources };

    case 'issue_meal_voucher':
    case 'issue_lounge_access':
    case 'arrange_delayed_hours_hotel': {
      if (booking?.status !== 'Delayed') {
        return {
          authorized: false,
          reason: 'Delay compensations require a delayed booking.',
          policySources: sources,
        };
      }
      const comp = calculateDelayCompensation(booking.delayHours);
      const entitled =
        action === 'issue_meal_voucher'
          ? comp.mealVoucher
          : action === 'issue_lounge_access'
            ? comp.loungeAccess
            : comp.hotelForDelayedHours;
      return {
        authorized: entitled,
        reason: entitled
          ? action === 'issue_meal_voucher'
            ? 'Meal voucher granted for the delay.'
            : action === 'issue_lounge_access'
              ? 'Lounge access granted: delay exceeds 3 hours.'
              : 'Hotel granted for the delayed hours only: delay exceeds 5 hours.'
          : 'No entitlement for this delay length under the supplied bands.',
        policySources: sources,
      };
    }

    case 'rebook_within_24_hours':
    case 'initiate_refund': {
      if (booking?.status !== 'Cancelled') {
        return {
          authorized: false,
          reason: 'Rebooking/refund require a cancelled booking.',
          policySources: sources,
        };
      }
      const airlineCaused =
        booking.cancellationReason.toLowerCase() === 'operational reasons';
      return {
        authorized: airlineCaused,
        reason: airlineCaused
          ? 'Airline-caused cancellation permits free rebooking within 24 hours or a full refund.'
          : 'Non-airline-caused disruptions allow no exceptions.',
        policySources: sources,
      };
    }

    case 'priority_rebooking':
      return {
        authorized: customer !== null && loyaltyBenefits(customer.loyaltyTier, policies.loyalty).priorityRebooking,
        reason:
          customer !== null && loyaltyBenefits(customer.loyaltyTier, policies.loyalty).priorityRebooking
            ? 'Gold/Platinum tiers receive priority rebooking.'
            : 'Priority rebooking is limited to Gold and Platinum tiers.',
        policySources: sources,
      };

    case 'waive_fare_difference':
      return {
        authorized: false,
        reason:
          'Fare-difference waivers are decided by evaluateFareDifference (waivers above ₹1,500 need supervisor approval); authorize through that path.',
        policySources: sources,
      };

    default: {
      const exhaustive: never = action;
      void exhaustive;
      return {
        authorized: false,
        reason: 'Unhandled action.',
        policySources: sources,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Escalation requirement
// ---------------------------------------------------------------------------

/**
 * Escalation gate: recognizes every prohibited category from the supplied
 * policy and flags supervisor escalation where agents have no authority.
 */
export function evaluateEscalationRequirement(
  request: EscalationRequest,
  context: EscalationContext
): PolicyDecision {
  const base = { policySources: [SOURCE_PROHIBITED] };

  switch (request.type) {
    case 'fare_waiver_above_limit':
      return decision({
        ...base,
        status: 'escalation_required',
        eligibleActions: [],
        ineligibleActions: ['waive_fare_difference'],
        requiresEscalation: true,
        escalationReason: `Fare-difference waiver above ₹1,500 requires supervisor approval${request.detail ? ` (requested: ${request.detail})` : ''}.`,
        explanation:
          'Agents may waive up to ₹1,500; anything above goes to a supervisor.',
      });

    case 'non_original_refund_method':
      return decision({
        ...base,
        status: 'escalation_required',
        eligibleActions: [],
        ineligibleActions: ['initiate_refund'],
        requiresEscalation: true,
        escalationReason:
          'Refund to a payment method other than the original is prohibited; supervisor review required.',
        explanation:
          'Refunds must always go to the original payment method; a different method needs supervisor review.',
      });

    case 'compensation_beyond_policy':
      return decision({
        ...base,
        status: 'escalation_required',
        eligibleActions: [],
        ineligibleActions: [],
        requiresEscalation: true,
        escalationReason:
          'Compensation beyond the supplied policy is prohibited for agents.',
        explanation:
          'The requested compensation exceeds the supplied policy; escalate to a supervisor.',
      });

    case 'legal_or_formal_complaint':
      return decision({
        ...base,
        status: 'escalation_required',
        eligibleActions: [],
        ineligibleActions: [],
        requiresEscalation: true,
        escalationReason:
          'Legal or formal complaints must be handled with escalation; agents may not resolve them.',
        explanation:
          'Formal/legal complaints are outside agent authority and require escalation.',
      });

    case 'exception_non_airline_cause':
      if (!context.airlineCaused) {
        return decision({
          ...base,
          status: 'ineligible',
          eligibleActions: [],
          ineligibleActions: [],
          explanation:
            'Disruption is not airline-caused: no exceptions are permitted under the supplied policy.',
        });
      }
      return decision({
        ...base,
        status: 'eligible',
        eligibleActions: [],
        explanation:
          'Disruption is airline-caused; standard remedies apply without escalation.',
      });

    case 'other':
      return decision({
        ...base,
        status: 'clarification_required',
        eligibleActions: [],
        ineligibleActions: [],
        explanation:
          'Request type is unclear; ask a clarifying question before deciding.',
      });
  }
}
