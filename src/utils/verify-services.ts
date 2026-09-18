/**
 * Service-layer verification script.
 * Exercises every service function against the seed data, including the
 * case-insensitivity and not-found contracts.
 *
 * Run with: npm run verify:services
 */

import type {
  BookingStatusSummary,
  CancelledBooking,
  DelayedBooking,
  PolicyEnvelope,
} from '../types';

import {
  getAllCustomers,
  getCustomerByName,
  getCustomerByPnr,
  getCustomerProfile,
} from '../services/customer.service';

import {
  getBookingByFlightNumber,
  getBookingStatus,
  getBookingsByPnr,
  getPrimaryDisruptedBooking,
} from '../services/booking.service';

import {
  getAllPolicies,
  getAllowedActions,
  getCancellationPolicy,
  getDelayCompensationPolicy,
  getFareDifferencePolicy,
  getLoyaltyPolicy,
  getProhibitedActions,
  getRefundPolicy,
} from '../services/policy.service';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✔ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Customer service
// ---------------------------------------------------------------------------

console.log('\n=== 1. Customer service ===');

check('getAllCustomers returns 3', getAllCustomers().length === 3);

check(
  'getCustomerByPnr(SK4821X) -> Priya Nair (Gold)',
  getCustomerByPnr('SK4821X')?.name === 'Priya Nair' &&
    getCustomerByPnr('SK4821X')?.loyaltyTier === 'Gold'
);
check(
  'case-insensitive: getCustomerByPnr("  sk4821x ") -> Priya Nair',
  getCustomerByPnr('  sk4821x ')?.pnr === 'SK4821X'
);
check(
  'getCustomerByPnr(TR1190B) -> Arvind Kulkarni (Silver)',
  getCustomerByPnr('TR1190B')?.loyaltyTier === 'Silver'
);
check(
  'getCustomerByPnr(WL7742) -> Meher Kaur (Platinum)',
  getCustomerByPnr('wl7742')?.loyaltyTier === 'Platinum'
);
check(
  'getCustomerByPnr(UNKNOWN1) -> undefined',
  getCustomerByPnr('UNKNOWN1') === undefined
);
check(
  'getCustomerByName("priya NAIR") -> found',
  getCustomerByName('priya NAIR')?.pnr === 'SK4821X'
);
check(
  'getCustomerByName("  Meher    kaur ") -> found (whitespace-normalized)',
  getCustomerByName('  Meher    kaur ')?.pnr === 'WL7742'
);
check(
  'getCustomerByName("Nobody") -> undefined',
  getCustomerByName('Nobody') === undefined
);

const priyaProfile = getCustomerProfile('SK4821X');
check(
  'getCustomerProfile(SK4821X) embeds 2 bookings',
  priyaProfile !== undefined &&
    priyaProfile.bookings.length === 2 &&
    priyaProfile.email === 'priya.nair@example.com'
);
check(
  'getCustomerProfile(UNKNOWN1) -> undefined',
  getCustomerProfile('UNKNOWN1') === undefined
);

// ---------------------------------------------------------------------------
// 2. Booking service
// ---------------------------------------------------------------------------

console.log('\n=== 2. Booking service ===');

// Priya: cancelled outbound + unaffected return
const priyaLegs = getBookingsByPnr('sk4821x');
const priyaCancelled = priyaLegs.find(
  (b): b is CancelledBooking => b.status === 'Cancelled'
);
const priyaReturn = priyaLegs.find((b) => b.status === 'Unaffected');
check(
  'Priya (SK4821X): 2 legs — SK-204 cancelled + unaffected return',
  priyaLegs.length === 2 &&
    priyaCancelled?.flight === 'SK-204' &&
    priyaCancelled?.cancellationReason === 'Operational reasons' &&
    priyaReturn?.flight === 'Return' &&
    priyaReturn?.date === '2026-09-25'
);

// Arvind: 4-hour delay
const arvindLegs = getBookingsByPnr('TR1190B');
const arvind = arvindLegs.find(
  (b): b is DelayedBooking => b.status === 'Delayed'
);
check(
  'Arvind (TR1190B): SK-118 delayed 4h, new departure 11:10',
  arvindLegs.length === 1 &&
    arvind?.delayHours === 4 &&
    arvind?.newDeparture === '11:10'
);

// Meher: 6-hour delay
const meherLegs = getBookingsByPnr('WL7742');
const meher = meherLegs.find(
  (b): b is DelayedBooking => b.status === 'Delayed'
);
check(
  'Meher (WL7742): SK-305 delayed 6h, new departure 20:00',
  meherLegs.length === 1 &&
    meher?.delayHours === 6 &&
    meher?.newDeparture === '20:00'
);

check(
  'getBookingsByPnr("") -> []',
  getBookingsByPnr('').length === 0
);

const byFlight = getBookingByFlightNumber('sk-118');
check(
  'getBookingByFlightNumber("sk-118") -> 1 delayed leg (case-insensitive)',
  byFlight.length === 1 && byFlight[0]?.pnr === 'TR1190B'
);
check(
  'getBookingByFlightNumber("ZZ-999") -> []',
  getBookingByFlightNumber('ZZ-999').length === 0
);

const priyaPrimary = getPrimaryDisruptedBooking('SK4821X');
check(
  'Priya primary disruption -> cancelled SK-204 (cancellation outranks)',
  priyaPrimary?.status === 'Cancelled' && priyaPrimary?.flight === 'SK-204'
);
check(
  'Arvind primary disruption -> 4h delay',
  getPrimaryDisruptedBooking('TR1190B')?.status === 'Delayed'
);
check(
  'Meher primary disruption -> 6h delay',
  getPrimaryDisruptedBooking('WL7742')?.status === 'Delayed'
);
check(
  'getPrimaryDisruptedBooking(UNKNOWN1) -> undefined',
  getPrimaryDisruptedBooking('UNKNOWN1') === undefined
);

const priyaStatus: BookingStatusSummary | undefined = getBookingStatus('SK4821X');
check(
  'getBookingStatus(SK4821X): 2 legs, hasDisruption, primary=cancellation',
  priyaStatus !== undefined &&
    priyaStatus.totalLegs === 2 &&
    priyaStatus.hasDisruption === true &&
    priyaStatus.primaryDisruption?.kind === 'cancellation' &&
    priyaStatus.primaryDisruption?.flight === 'SK-204'
);

const arvindStatus = getBookingStatus('tr1190b');
check(
  'getBookingStatus(tr1190b): primary=delay 4h (case-insensitive)',
  arvindStatus !== undefined &&
    arvindStatus.primaryDisruption?.kind === 'delay' &&
    arvindStatus.primaryDisruption?.delayHours === 4
);

const meherStatus = getBookingStatus('WL7742');
check(
  'getBookingStatus(WL7742): primary=delay 6h',
  meherStatus !== undefined &&
    meherStatus.primaryDisruption?.kind === 'delay' &&
    meherStatus.primaryDisruption?.delayHours === 6
);

check(
  'getBookingStatus(UNKNOWN1) -> undefined',
  getBookingStatus('UNKNOWN1') === undefined
);

// ---------------------------------------------------------------------------
// 3. Policy service
// ---------------------------------------------------------------------------

console.log('\n=== 3. Policy service ===');

function isEnvelope(value: unknown): value is PolicyEnvelope<unknown> {
  const env = value as PolicyEnvelope<unknown>;
  return (
    typeof env === 'object' && env !== null &&
    typeof env.policyId === 'string' && env.policyId.length > 0 &&
    typeof env.source === 'string' && env.source.startsWith('Supplied Service Rules') &&
    'details' in env
  );
}

const all = getAllPolicies();
check(
  'getAllPolicies exposes all 7 categories as envelopes',
  [all.cancellation, all.delay, all.refund, all.fareDifference, all.loyalty, all.allowedActions, all.prohibited].every(isEnvelope)
);

const cancellation = getCancellationPolicy();
check(
  'cancellation: policyId + 2 options (rebook within 24h / full refund)',
  isEnvelope(cancellation) &&
    cancellation.policyId === 'cancellation' &&
    cancellation.details.options.length === 2
);

const delay = getDelayCompensationPolicy();
check(
  'delay_compensation: 3 tiers with 3h/5h thresholds',
  isEnvelope(delay) &&
    delay.policyId === 'delay_compensation' &&
    delay.source === 'Supplied Service Rules - Delay Compensation Rule' &&
    delay.details.tiers.length === 3 &&
    delay.details.tiers[0]?.upToHours === 3 &&
    delay.details.tiers[2]?.moreThanHours === 5
);

const refund = getRefundPolicy();
check(
  'refund: full refund, 7 business days, original method',
  isEnvelope(refund) &&
    refund.details.timeframe === 'Within 7 business days' &&
    refund.details.method === 'Original payment method only'
);

const fare = getFareDifferencePolicy();
check(
  'fare_difference: ₹1,500 approval threshold',
  isEnvelope(fare) &&
    fare.details.maxWaiverWithoutApprovalInr === 1500
);

const loyalty = getLoyaltyPolicy();
check(
  'loyalty: Gold+Platinum priority rebooking',
  isEnvelope(loyalty) &&
    loyalty.details.priorityRebookingTiers.includes('Gold') &&
    loyalty.details.priorityRebookingTiers.includes('Platinum')
);

const allowed = getAllowedActions();
check(
  'allowed_actions: exactly 6 with known ids',
  isEnvelope(allowed) &&
    allowed.details.length === 6 &&
    allowed.details.some((a) => a.id === 'rebook_within_24_hours') &&
    allowed.details.some((a) => a.id === 'provide_booking_status')
);

const prohibited = getProhibitedActions();
check(
  'prohibited_actions: exactly 5 rules',
  isEnvelope(prohibited) && prohibited.details.length === 5
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n──────────────────────────────');
if (failures === 0) {
  console.log('✅ ALL SERVICE-LAYER CHECKS PASSED');
  process.exit(0);
} else {
  console.error(`❌ ${failures} check(s) FAILED`);
  process.exit(1);
}
