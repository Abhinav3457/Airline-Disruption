/**
 * Data-layer verification script.
 * Validates every seed JSON file against its zod schema, verifies the exact
 * assignment data (3 customers, 4 bookings, all policies), cross-checks
 * integrity between files, and prints a summary.
 *
 * Run with: npm run verify:data
 */

import type { CancelledBooking, DelayedBooking } from '../types';

import {
  findBookingsByPnr,
  findCustomerByPnr,
  getActionLogs,
  getBookings,
  getCustomers,
  getPolicies,
} from '../data/store';

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
// 1. JSON validity (each accessor throws with zod details on invalid data)
// ---------------------------------------------------------------------------

console.log('\n=== 1. JSON validity & schema validation ===');

let customers, bookings, policies, actionLogs;
try {
  customers = getCustomers();
  bookings = getBookings();
  policies = getPolicies();
  actionLogs = getActionLogs();
  check('customers.json matches Customer[] schema', true);
  check('bookings.json matches Booking[] schema (discriminated union)', true);
  check('policies.json matches PolicyDocument schema', true);
  check(
    'action-logs.json matches ActionLog[] schema (seed starts empty; runtime appends)',
    Array.isArray(actionLogs)
  );
} catch (err) {
  failures += 1;
  console.error(`  ✘ Seed data failed validation:\n${String(err)}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Customers — exactly the 3 from the assignment
// ---------------------------------------------------------------------------

console.log('\n=== 2. Customers (expect exactly 3) ===');
check('exactly 3 customers', customers.length === 3, `found ${customers.length}`);

const expectedCustomers = [
  {
    name: 'Priya Nair',
    loyaltyTier: 'Gold',
    pnr: 'SK4821X',
    email: 'priya.nair@example.com',
    phone: '+91-98xxxxxx1',
    flightsLast12Months: 6,
    complaintCount: 1,
  },
  {
    name: 'Arvind Kulkarni',
    loyaltyTier: 'Silver',
    pnr: 'TR1190B',
    email: 'arvind.kulkarni@example.com',
    phone: '+91-98xxxxxx2',
    flightsLast12Months: 3,
    complaintCount: 0,
  },
  {
    name: 'Meher Kaur',
    loyaltyTier: 'Platinum',
    pnr: 'WL7742',
    email: 'meher.kaur@example.com',
    phone: '+91-98xxxxxx3',
    flightsLast12Months: 10,
    complaintCount: 1,
  },
] as const;

for (const expected of expectedCustomers) {
  const customer = findCustomerByPnr(expected.pnr);
  const matches =
    customer !== undefined &&
    customer.name === expected.name &&
    customer.loyaltyTier === expected.loyaltyTier &&
    customer.email === expected.email &&
    customer.phone === expected.phone &&
    customer.travelHistory.flightsLast12Months ===
      expected.flightsLast12Months &&
    customer.previousComplaints.length === expected.complaintCount;

  check(
    `${expected.name} — ${expected.loyaltyTier} — PNR ${expected.pnr} — ${expected.flightsLast12Months} flights/12mo — ${expected.complaintCount} prior complaint(s)`,
    matches
  );
}

// ---------------------------------------------------------------------------
// 3. Bookings — exactly the 4 from the assignment
// ---------------------------------------------------------------------------

console.log('\n=== 3. Bookings (expect exactly 4) ===');
check('exactly 4 bookings', bookings.length === 4, `found ${bookings.length}`);

// Priya Nair — SK4821X: cancelled outbound + unaffected return
const priyaLegs = findBookingsByPnr('SK4821X');
check('Priya Nair (SK4821X) has 2 booking legs', priyaLegs.length === 2,
  `found ${priyaLegs.length}`);

const priyaCancelled = priyaLegs.find(
  (booking): booking is CancelledBooking => booking.status === 'Cancelled'
);
check(
  'SK-204 Delhi → Goa 2026-09-23 18:40 — Cancelled (Operational reasons)',
  priyaCancelled !== undefined &&
    priyaCancelled.flight === 'SK-204' &&
    priyaCancelled.route.from === 'Delhi' &&
    priyaCancelled.route.to === 'Goa' &&
    priyaCancelled.date === '2026-09-23' &&
    priyaCancelled.scheduledDeparture === '18:40' &&
    priyaCancelled.cancellationReason === 'Operational reasons'
);

const priyaReturn = priyaLegs.find(
  (booking) => booking.status === 'Unaffected'
);
check(
  'Return Goa → Delhi 2026-09-25 16:20 — Unaffected',
  priyaReturn !== undefined &&
    priyaReturn.flight === 'Return' &&
    priyaReturn.route.from === 'Goa' &&
    priyaReturn.route.to === 'Delhi' &&
    priyaReturn.date === '2026-09-25' &&
    priyaReturn.scheduledDeparture === '16:20'
);

// Arvind Kulkarni — TR1190B: 4h delay
const arvindLegs = findBookingsByPnr('TR1190B');
const arvindDelayed = arvindLegs.find(
  (booking): booking is DelayedBooking => booking.status === 'Delayed'
);
check(
  'SK-118 Mumbai → Bengaluru 2026-09-23 07:10 — Delayed 4h, new departure 11:10',
  arvindLegs.length === 1 &&
    arvindDelayed !== undefined &&
    arvindDelayed.flight === 'SK-118' &&
    arvindDelayed.route.from === 'Mumbai' &&
    arvindDelayed.route.to === 'Bengaluru' &&
    arvindDelayed.date === '2026-09-23' &&
    arvindDelayed.scheduledDeparture === '07:10' &&
    arvindDelayed.delayHours === 4 &&
    arvindDelayed.newDeparture === '11:10'
);

// Meher Kaur — WL7742: 6h delay
const meherLegs = findBookingsByPnr('WL7742');
const meherDelayed = meherLegs.find(
  (booking): booking is DelayedBooking => booking.status === 'Delayed'
);
check(
  'SK-305 Delhi → Hyderabad 2026-09-23 14:00 — Delayed 6h, new departure 20:00',
  meherLegs.length === 1 &&
    meherDelayed !== undefined &&
    meherDelayed.flight === 'SK-305' &&
    meherDelayed.route.from === 'Delhi' &&
    meherDelayed.route.to === 'Hyderabad' &&
    meherDelayed.date === '2026-09-23' &&
    meherDelayed.scheduledDeparture === '14:00' &&
    meherDelayed.delayHours === 6 &&
    meherDelayed.newDeparture === '20:00'
);

// ---------------------------------------------------------------------------
// 4. Policies — all rules from the assignment
// ---------------------------------------------------------------------------

console.log('\n=== 4. Policies ===');

check(
  'cancellation: free rebooking within 24h OR full refund (2 options)',
  policies.cancellation.options.length === 2 &&
    policies.cancellation.options[0] ===
      'Free rebooking on next available flight within 24 hours' &&
    policies.cancellation.options[1] === 'Full refund'
);

check(
  'delay: 3 tiers with thresholds 3h / 3h+ / 5h+',
  policies.delay.tiers.length === 3 &&
    policies.delay.tiers[0]?.upToHours === 3 &&
    policies.delay.tiers[1]?.moreThanHours === 3 &&
    policies.delay.tiers[2]?.moreThanHours === 5
);
check(
  'delay tier entitlements: ₹500 voucher / +lounge / +delayed-hours hotel',
  policies.delay.tiers[0]?.entitlements[0] === '₹500 meal voucher' &&
    policies.delay.tiers[1]?.entitlements.length === 2 &&
    policies.delay.tiers[2]?.entitlements.length === 3 &&
    policies.delay.tiers[2]?.entitlements[2] ===
      'Hotel accommodation for delayed hours only'
);

check(
  'refund: full refund, within 7 business days, original payment method only',
  policies.refund.type === 'Full refund' &&
    policies.refund.timeframe === 'Within 7 business days' &&
    policies.refund.method === 'Original payment method only'
);

check(
  'fare difference: customer pays; waiver above ₹1,500 needs supervisor approval',
  policies.fareDifference.maxWaiverWithoutApprovalInr === 1500 &&
    policies.fareDifference.approvalRule ===
      'Fare difference above ₹1,500 cannot be waived without supervisor approval'
);

check(
  'loyalty: priority rebooking for Gold & Platinum only, no extra compensation',
  policies.loyalty.priorityRebookingTiers.length === 2 &&
    policies.loyalty.priorityRebookingTiers.includes('Gold') &&
    policies.loyalty.priorityRebookingTiers.includes('Platinum') &&
    !policies.loyalty.priorityRebookingTiers.includes('Silver') &&
    policies.loyalty.additionalCompensation ===
      'No additional compensation beyond standard policy'
);

check('allowed actions: exactly 6', policies.allowedActions.length === 6,
  `found ${policies.allowedActions.length}`);
check('prohibited rules: exactly 5', policies.prohibited.length === 5,
  `found ${policies.prohibited.length}`);

// ---------------------------------------------------------------------------
// 5. Cross-file integrity
// ---------------------------------------------------------------------------

console.log('\n=== 5. Cross-file integrity ===');

const bookingPnrs = new Set(bookings.map((booking) => booking.pnr));
check(
  'every booking PNR belongs to a known customer',
  [...bookingPnrs].every((pnr) => findCustomerByPnr(pnr) !== undefined)
);
check(
  'every customer has at least one booking',
  customers.every((customer) => bookingPnrs.has(customer.pnr))
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n──────────────────────────────');
if (failures === 0) {
  console.log('✅ ALL DATA-LAYER CHECKS PASSED');
  process.exit(0);
} else {
  console.error(`❌ ${failures} check(s) FAILED`);
  process.exit(1);
}
