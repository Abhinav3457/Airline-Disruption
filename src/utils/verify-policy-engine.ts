/**
 * Policy-engine verification script.
 * Tests every supplied rule, the three mandatory customer scenarios, the
 * boundary values (exactly 3h / 5h, ₹1,500 / ₹2,000), and the
 * authorization/escalation gates.
 *
 * Run with: npm run verify:engine
 */

import type {
  CancelledBooking,
  Customer,
  DelayedBooking,
  PolicyDecision,
} from '../types';

import {
  ENGINE_RULES,
  calculateDelayCompensation,
  evaluateActionAuthorization,
  evaluateCancellation,
  evaluateDelayRequest,
  evaluateEscalationRequirement,
  evaluateFareDifference,
  evaluateLoyaltyBenefits,
  evaluateRefundRequest,
} from '../agents/policy.engine';

import { getBookingsByPnr } from '../services/booking.service';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✔ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function statusIs(d: PolicyDecision, s: PolicyDecision['status']): boolean {
  return d.status === s;
}

// Real bookings from the data layer (no hardcoded fixtures)
const priyaCancelled = getBookingsByPnr('SK4821X').find(
  (b): b is CancelledBooking => b.status === 'Cancelled'
)!;
const priyaReturn = getBookingsByPnr('SK4821X').find(
  (b) => b.status === 'Unaffected'
)!;
const arvind = getBookingsByPnr('TR1190B').find(
  (b): b is DelayedBooking => b.status === 'Delayed'
)!;
const meher = getBookingsByPnr('WL7742').find(
  (b): b is DelayedBooking => b.status === 'Delayed'
)!;

const priya: Customer = {
  name: 'Priya Nair',
  loyaltyTier: 'Gold',
  pnr: 'SK4821X',
  email: 'priya.nair@example.com',
  phone: '+91-98xxxxxx1',
  travelHistory: { flightsLast12Months: 6 },
  previousComplaints: [
    { issue: 'Delayed baggage', resolution: 'Resolved with voucher' },
  ],
};
const arvindCustomer: Customer = { ...priya, name: 'Arvind Kulkarni', loyaltyTier: 'Silver', pnr: 'TR1190B', email: 'arvind.kulkarni@example.com', phone: '+91-98xxxxxx2', travelHistory: { flightsLast12Months: 3 }, previousComplaints: [] };
const meherCustomer: Customer = { ...priya, name: 'Meher Kaur', loyaltyTier: 'Platinum', pnr: 'WL7742', email: 'meher.kaur@example.com', phone: '+91-98xxxxxx3', travelHistory: { flightsLast12Months: 10 }, previousComplaints: [{ issue: 'Overbooking', resolution: 'Resolved with tier-status upgrade' }] };

// ---------------------------------------------------------------------------
// 1. Cancellation rules
// ---------------------------------------------------------------------------

console.log('\n=== 1. Cancellation ===');

const rebook = evaluateCancellation(priyaCancelled, 'rebook');
check('airline-caused cancellation + rebook -> eligible rebook_within_24_hours',
  statusIs(rebook, 'eligible') && rebook.eligibleActions.includes('rebook_within_24_hours'));
check('rebooking window is 24 hours', rebook.rebookingWindowHours === 24);

const refund = evaluateCancellation(priyaCancelled, 'refund');
check('airline-caused cancellation + refund -> eligible initiate_refund',
  statusIs(refund, 'eligible') && refund.eligibleActions.includes('initiate_refund'));

const nonAirline: CancelledBooking = { ...priyaCancelled, cancellationReason: 'Weather' };
const nonAirlineRebook = evaluateCancellation(nonAirline, 'rebook');
check('non-airline-caused cancellation -> ineligible (no exceptions)',
  statusIs(nonAirlineRebook, 'ineligible') && !nonAirlineRebook.eligibleActions.length);

const unaffectedRebook = evaluateCancellation(priyaReturn, 'rebook');
check('unaffected booking -> ineligible for cancellation remedies',
  statusIs(unaffectedRebook, 'ineligible'));

// ---------------------------------------------------------------------------
// 2. Delay compensation calculator + boundaries
// ---------------------------------------------------------------------------

console.log('\n=== 2. Delay compensation & boundaries ===');

const b1 = calculateDelayCompensation(1);
check('1h: voucher only', b1.mealVoucher && !b1.loungeAccess && !b1.hotelForDelayedHours);

const b3 = calculateDelayCompensation(3);
check('exactly 3h: voucher YES, lounge NO (3 is not "more than 3")',
  b3.mealVoucher && !b3.loungeAccess && !b3.hotelForDelayedHours);

const b4 = calculateDelayCompensation(4);
check('4h: voucher + lounge, hotel NO', b4.mealVoucher && b4.loungeAccess && !b4.hotelForDelayedHours);

const b5 = calculateDelayCompensation(5);
check('exactly 5h: voucher + lounge YES, hotel NO (5 is not "more than 5")',
  b5.mealVoucher && b5.loungeAccess && !b5.hotelForDelayedHours);

const b6 = calculateDelayCompensation(6);
check('6h: voucher + lounge + hotel (delayed hours only)',
  b6.mealVoucher && b6.loungeAccess && b6.hotelForDelayedHours);

let threw = false;
try { calculateDelayCompensation(-1); } catch { threw = true; }
check('negative delayHours throws RangeError', threw);

// ---------------------------------------------------------------------------
// 3. Delay request evaluation (Arvind 4h / Meher 6h)
// ---------------------------------------------------------------------------

console.log('\n=== 3. Delay requests ===');

const arvindVoucher = evaluateDelayRequest(arvind, 'issue_meal_voucher');
check('Arvind 4h: meal voucher eligible', statusIs(arvindVoucher, 'eligible'));

const arvindLounge = evaluateDelayRequest(arvind, 'issue_lounge_access');
check('Arvind 4h: lounge eligible', statusIs(arvindLounge, 'eligible'));

const arvindHotel = evaluateDelayRequest(arvind, 'arrange_delayed_hours_hotel');
check('Arvind 4h: hotel NOT eligible', statusIs(arvindHotel, 'ineligible'));

const meherVoucher = evaluateDelayRequest(meher, 'issue_meal_voucher');
check('Meher 6h: meal voucher eligible', statusIs(meherVoucher, 'eligible'));

const meherLounge = evaluateDelayRequest(meher, 'issue_lounge_access');
check('Meher 6h: lounge eligible', statusIs(meherLounge, 'eligible'));

const meherHotel = evaluateDelayRequest(meher, 'arrange_delayed_hours_hotel');
check('Meher 6h: delayed-hours hotel eligible', statusIs(meherHotel, 'eligible'));

const delayRebook = evaluateDelayRequest(arvind, 'rebook_within_24_hours');
check('delay + rebook -> ineligible (rebooking is a cancellation remedy)',
  statusIs(delayRebook, 'ineligible'));

// ---------------------------------------------------------------------------
// 4. Refund rules
// ---------------------------------------------------------------------------

console.log('\n=== 4. Refund ===');

const refundOriginal = evaluateRefundRequest(priyaCancelled, 'original');
check('original payment method -> eligible, 7 business days',
  statusIs(refundOriginal, 'eligible') && refundOriginal.refundTimeframe === 'Within 7 business days');

const refundOther = evaluateRefundRequest(priyaCancelled, 'different-card');
check('non-original payment method -> escalation_required',
  statusIs(refundOther, 'escalation_required') && refundOther.requiresEscalation);

const refundUnaffected = evaluateRefundRequest(priyaReturn, 'original');
check('refund on unaffected booking -> clarification_required',
  statusIs(refundUnaffected, 'clarification_required'));

// ---------------------------------------------------------------------------
// 5. Fare difference & waiver boundaries
// ---------------------------------------------------------------------------

console.log('\n=== 5. Fare difference ===');

const noWaiver = evaluateFareDifference(2000, 0);
check('no waiver requested -> customer pays difference',
  statusIs(noWaiver, 'eligible') && !noWaiver.eligibleActions.includes('waive_fare_difference'));

const w1000 = evaluateFareDifference(2000, 1000);
check('₹1,000 waiver -> eligible (within agent authority)',
  statusIs(w1000, 'eligible') && w1000.eligibleActions.includes('waive_fare_difference'));

const w1500 = evaluateFareDifference(2000, 1500);
check('exactly ₹1,500 waiver -> eligible (not "above" ₹1,500)',
  statusIs(w1500, 'eligible') && w1500.eligibleActions.includes('waive_fare_difference'));

const w1501 = evaluateFareDifference(2000, 1501);
check('₹1,501 waiver -> escalation_required',
  statusIs(w1501, 'escalation_required') && w1501.requiresEscalation);

const w2000 = evaluateFareDifference(2000, 2000);
check('₹2,000 waiver -> escalation_required (Meher scenario)',
  statusIs(w2000, 'escalation_required') &&
    (w2000.escalationReason?.includes('1500') ?? false));

const wOver = evaluateFareDifference(1000, 2000);
check('waiver > difference -> clarification_required',
  statusIs(wOver, 'clarification_required'));

// ---------------------------------------------------------------------------
// 6. Loyalty
// ---------------------------------------------------------------------------

console.log('\n=== 6. Loyalty ===');

const priyaLoyalty = evaluateLoyaltyBenefits(priya);
check('Priya (Gold): priority rebooking eligible',
  priyaLoyalty.eligibleActions.includes('priority_rebooking'));

const arvindLoyalty = evaluateLoyaltyBenefits(arvindCustomer);
check('Arvind (Silver): no priority rebooking',
  statusIs(arvindLoyalty, 'ineligible'));

const meherLoyalty = evaluateLoyaltyBenefits(meherCustomer);
check('Meher (Platinum): priority rebooking, but NO extra compensation',
  meherLoyalty.eligibleActions.includes('priority_rebooking') &&
    !meherLoyalty.eligibleActions.includes('issue_meal_voucher'));

// ---------------------------------------------------------------------------
// 7. Action authorization gate
// ---------------------------------------------------------------------------

console.log('\n=== 7. Action authorization ===');

const authMeherHotel = evaluateActionAuthorization('arrange_delayed_hours_hotel', { customer: meherCustomer, booking: meher });
check('authorize Meher 6h delayed-hours hotel -> allowed',
  authMeherHotel.authorized);

const authArvindHotel = evaluateActionAuthorization('arrange_delayed_hours_hotel', { customer: arvindCustomer, booking: arvind });
check('authorize Arvind 4h hotel -> DENIED',
  !authArvindHotel.authorized);

const authPriyaRefund = evaluateActionAuthorization('initiate_refund', { customer: priya, booking: priyaCancelled });
check('authorize Priya refund (airline-caused) -> allowed',
  authPriyaRefund.authorized);

const authNonAirline = evaluateActionAuthorization('initiate_refund', { customer: priya, booking: nonAirline });
check('authorize non-airline-caused refund -> DENIED',
  !authNonAirline.authorized);

const authSilverPriority = evaluateActionAuthorization('priority_rebooking', { customer: arvindCustomer, booking: arvind });
check('authorize priority rebooking for Silver -> DENIED',
  !authSilverPriority.authorized);

const authStatus = evaluateActionAuthorization('provide_booking_status', { customer: null, booking: null });
check('provide_booking_status always allowed',
  authStatus.authorized);

// ---------------------------------------------------------------------------
// 8. Escalation
// ---------------------------------------------------------------------------

console.log('\n=== 8. Escalation ===');

const escFare = evaluateEscalationRequirement({ type: 'fare_waiver_above_limit', detail: '₹2,000' }, { airlineCaused: true });
check('fare waiver above limit -> escalation', escFare.requiresEscalation);

const escRefund = evaluateEscalationRequirement({ type: 'non_original_refund_method' }, { airlineCaused: true });
check('non-original refund method -> escalation', escRefund.requiresEscalation);

const escLegal = evaluateEscalationRequirement({ type: 'legal_or_formal_complaint' }, { airlineCaused: true });
check('legal/formal complaint -> escalation', escLegal.requiresEscalation);

const escBeyond = evaluateEscalationRequirement({ type: 'compensation_beyond_policy' }, { airlineCaused: true });
check('compensation beyond policy -> escalation', escBeyond.requiresEscalation);

const escNonAirline = evaluateEscalationRequirement({ type: 'exception_non_airline_cause' }, { airlineCaused: false });
check('non-airline-cause exception -> ineligible (not escalated)',
  statusIs(escNonAirline, 'ineligible') && !escNonAirline.requiresEscalation);

const escAirline = evaluateEscalationRequirement({ type: 'exception_non_airline_cause' }, { airlineCaused: true });
check('airline-cause -> standard remedies, no escalation',
  statusIs(escAirline, 'eligible') && !escAirline.requiresEscalation);

// ---------------------------------------------------------------------------
// 9. Mandatory end-to-end scenarios
// ---------------------------------------------------------------------------

console.log('\n=== 9. Mandatory scenarios ===');

// Priya: refund eligible, business-class upgrade NOT covered, Gold priority rebooking only
const priyaRefundDecision = evaluateRefundRequest(priyaCancelled, 'original');
check('PRIYA: cancellation refund eligible',
  statusIs(priyaRefundDecision, 'eligible') && priyaRefundDecision.eligibleActions.includes('initiate_refund'));

const priyaUpgrade = evaluateFareDifference(8000, 0);
check('PRIYA: business-class upgrade (fare difference) not covered by policy',
  priyaUpgrade.eligibleActions.length === 0 &&
    priyaUpgrade.explanation.includes('customer pays'));

const priyaLoyaltyCheck = evaluateLoyaltyBenefits(priya);
check('PRIYA: Gold -> priority rebooking ONLY (no extra compensation)',
  priyaLoyaltyCheck.eligibleActions.length === 1 &&
    priyaLoyaltyCheck.eligibleActions[0] === 'priority_rebooking');

// Arvind: 4h delay -> voucher + lounge, NO hotel
check('ARVIND: 4h -> voucher eligible, lounge eligible, hotel NOT eligible',
  statusIs(arvindVoucher, 'eligible') &&
    statusIs(arvindLounge, 'eligible') &&
    statusIs(arvindHotel, 'ineligible'));

// Meher: 6h -> voucher + lounge + delayed-hours hotel; full-night hotel never; ₹2,000 waiver escalates
check('MEHER: 6h -> voucher + lounge + delayed-hours hotel eligible',
  statusIs(meherVoucher, 'eligible') &&
    statusIs(meherLounge, 'eligible') &&
    statusIs(meherHotel, 'eligible'));

const meherFullNight = evaluateActionAuthorization('arrange_delayed_hours_hotel', {
  customer: meherCustomer,
  booking: meher,
});
check('MEHER: hotel authorization is scoped to delayed hours only (never full-night)',
  meherFullNight.authorized && meherFullNight.reason.includes('delayed hours'));

check('MEHER: ₹2,000 waiver requires escalation',
  statusIs(w2000, 'escalation_required'));

// Every decision carries source labels + explanation
const allDecisions = [rebook, refund, arvindVoucher, meherHotel, refundOriginal, w2000, priyaLoyaltyCheck, escFare];
check('every decision has policySources and explanation',
  allDecisions.every((d) => d.policySources.length > 0 && d.explanation.length > 0));

check('ENGINE_RULES matches supplied policy (24h window, ₹1,500 cap, 3h/5h tiers)',
  ENGINE_RULES.rebookingWindowHours === 24 &&
    ENGINE_RULES.maxWaiverWithoutApprovalInr === 1500 &&
    ENGINE_RULES.delayTier1MaxHours === 3 &&
    ENGINE_RULES.delayTier3MoreThanHours === 5);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n──────────────────────────────');
if (failures === 0) {
  console.log('✅ ALL POLICY-ENGINE CHECKS PASSED');
  process.exit(0);
} else {
  console.error(`❌ ${failures} check(s) FAILED`);
  process.exit(1);
}
