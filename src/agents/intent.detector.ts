/**
 * Intent detector (rule-based).
 * Classifies what the customer is asking for from keyword evidence.
 * Detection NEVER overrides policy: the policy engine retains exclusive
 * authority over eligibility; unknown input returns intent 'unknown'.
 *
 * An LLM classifier can replace the rule table later without changing
 * the IntentResult contract.
 */

import type { IntentEntities, IntentResult } from '../types';

import { normalizePnr } from '../utils/strings';

/**
 * Ordered rule table: first match wins.
 * Specific intents are listed before general ones so that e.g.
 * 'issue a meal voucher for my delay' classifies as meal_voucher_request,
 * not delay_compensation. Legal complaints come first: they must always
 * route to escalation.
 */
const RULES: Array<{
  intent: IntentResult['intent'];
  confidence: number;
  patterns: RegExp[];
}> = [
  {
    intent: 'legal_complaint',
    confidence: 0.97,
    patterns: [
      /\blegal action\b/i,
      /\bsee (you )?in court\b/i,
      /\bsue\b/i,
      /\bconsumer court\b/i,
      /\bformal complaint\b/i,
      /\bombudsman\b/i,
    ],
  },
  {
    intent: 'meal_voucher_request',
    confidence: 0.93,
    patterns: [/\bmeal\b/i, /\bvoucher\b/i, /\bfood\b/i],
  },
  {
    intent: 'lounge_request',
    confidence: 0.93,
    patterns: [/\blounge\b/i],
  },
  {
    intent: 'hotel_request',
    confidence: 0.93,
    patterns: [/\bhotel\b/i, /\baccommodation\b/i, /\broom\b/i, /\bstay\b/i],
  },
  {
    intent: 'fare_difference_request',
    confidence: 0.9,
    patterns: [
      /\bfare difference\b/i,
      /\bwaive\b/i,
      /\bwaiver\b/i,
      /\bfare\b.*\bdifference\b/i,
    ],
  },
  {
    intent: 'refund_request',
    confidence: 0.94,
    patterns: [/\brefund\b/i, /\bmoney back\b/i],
  },
  {
    intent: 'upgrade_request',
    confidence: 0.9,
    patterns: [
      /\bupgrade\b/i,
      /\bbusiness class\b/i,
      /\bfirst class\b/i,
      /\bpremium\b/i,
    ],
  },
  {
    intent: 'rebooking_request',
    confidence: 0.92,
    patterns: [
      /\bre-?book\b/i,
      /\bnext (available )?flight\b/i,
      /\banother flight\b/i,
      /\bput me on\b/i,
    ],
  },
  {
    intent: 'cancellation_support',
    confidence: 0.88,
    patterns: [/\bcancelled\b/i, /\bcancellation\b/i, /\bmy flight is cancelled\b/i],
  },
  {
    intent: 'delay_compensation',
    confidence: 0.85,
    patterns: [/\bdelay(ed)?\b/i, /\bhours? late\b/i, /\bcompensat/i],
  },
  {
    intent: 'flight_status',
    confidence: 0.85,
    patterns: [
      /\bstatus\b/i,
      /\bon time\b/i,
      /\bwhat time\b/i,
      /\bis my flight\b/i,
      /\bwhen.*(depart|arrive|leave)\b/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// Entity extraction helpers
// ---------------------------------------------------------------------------

/** Word-boundary alphanumerics, 5-8 chars, with at least one letter and one digit. */
function extractPnr(text: string): string | undefined {
  const match = /\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{5,8}\b/i.exec(text);
  return match ? match[0] : undefined;
}

/** Airline-style flight numbers, e.g. SK-204 / SK204. */
function extractFlightNumber(text: string): string | undefined {
  const match = /\b[A-Z]{2}-?\d{2,4}\b/i.exec(text);
  return match ? match[0] : undefined;
}

function extractPaymentMethod(text: string): string | undefined {
  if (/\b(original|same) (card|payment|method)\b/i.test(text)) return 'original';
  if (
    /\b(different|another|other|new) (card|payment|method|account)\b/i.test(text) ||
    /\bto my (wife|husband|friend)s? (card|account)\b/i.test(text)
  ) {
    return 'different';
  }
  return undefined;
}

/** Parses ₹2,000 / INR 2000 / Rs. 2,000 / 2000 rupees. */
function extractWaiverAmount(text: string): number | undefined {
  const match =
    /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)|([0-9][0-9,]*)\s*(?:rupees|rs)\b/i.exec(
      text
    );
  if (!match) return undefined;

  const digits = (match[1] ?? match[2]).replace(/,/g, '');
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the customer's intent from a free-text message.
 * Entities (PNR, flight number, payment method, waiver amount) are extracted
 * regardless of which intent wins. Returns intent 'unknown' with confidence 0
 * when no rule matches.
 */
export function detectIntent(message: string): IntentResult {
  const entities: IntentEntities = {};
  const raw = message ?? '';

  const pnr = extractPnr(raw);
  if (pnr) entities.pnr = normalizePnr(pnr);

  const flightNumber = extractFlightNumber(raw);
  if (flightNumber) entities.flightNumber = flightNumber.toUpperCase();

  const paymentMethod = extractPaymentMethod(raw);
  if (paymentMethod) entities.paymentMethod = paymentMethod;

  const waiverAmount = extractWaiverAmount(raw);
  if (waiverAmount !== undefined) entities.waiverAmountInr = waiverAmount;

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(raw))) {
      return { intent: rule.intent, confidence: rule.confidence, entities };
    }
  }

  return { intent: 'unknown', confidence: 0, entities };
}
