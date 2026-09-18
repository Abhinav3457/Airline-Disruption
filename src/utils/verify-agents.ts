/**
 * Agent support modules verification.
 * Tests intent detection (all intents + entities), the simulated action
 * executor (policy-gated, prohibited refused), the escalation handler
 * (8 triggers + priorities), and the audit service (create/query/persist).
 *
 * Run with: npm run verify:agents
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ExecutedAction } from '../types';

import { detectIntent } from '../agents/intent.detector';

import { executeAction } from '../agents/action.executor';

import { escalate, noEscalation } from '../agents/escalation.handler';

import {
  createAuditRecord,
  getAllAuditRecords,
  getAuditRecordsByPnr,
} from '../services/audit.service';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✔ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function resolveAuditFile(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src', 'data', 'audit-logs.json'),
    path.resolve(process.cwd(), 'dist', 'data', 'audit-logs.json'),
  ];
  const found = candidates.find((file) => existsSync(file));
  if (!found) throw new Error('audit-logs.json not found');
  return found;
}

// ---------------------------------------------------------------------------
// 1. Intent detection — all intents
// ---------------------------------------------------------------------------

console.log('\n=== 1. Intent detection ===');

const intentCases: Array<{
  message: string;
  expected: string;
  note?: string;
}> = [
  { message: 'What is the status of my flight SK-204?', expected: 'flight_status' },
  { message: 'My flight was cancelled, what now?', expected: 'cancellation_support' },
  { message: 'I want a refund for my cancelled flight', expected: 'refund_request' },
  { message: 'Please rebook me on the next available flight', expected: 'rebooking_request' },
  { message: 'My flight is delayed 6 hours, what compensation?', expected: 'delay_compensation' },
  { message: 'Can I get a meal voucher for the delay?', expected: 'meal_voucher_request' },
  { message: 'Lounge access please', expected: 'lounge_request' },
  { message: 'I need a hotel room for the night', expected: 'hotel_request' },
  { message: 'Waive the fare difference of ₹2,000', expected: 'fare_difference_request', note: '₹2,000 entity expected' },
  { message: 'Can you upgrade me to business class?', expected: 'upgrade_request' },
  { message: 'I will take legal action over this', expected: 'legal_complaint' },
  { message: 'asdf qwerty zzz', expected: 'unknown' },
];

for (const testCase of intentCases) {
  const result = detectIntent(testCase.message);
  const extra =
    testCase.note && testCase.message.includes('₹2,000')
      ? ` && amount ${result.entities.waiverAmountInr}`
      : '';
  check(
    `"${testCase.message.slice(0, 44)}..." -> ${testCase.expected}${extra}`,
    result.intent === testCase.expected &&
      (testCase.expected !== 'fare_difference_request' ||
        result.entities.waiverAmountInr === 2000) &&
      (testCase.expected !== 'unknown' || result.confidence === 0)
  );
}

// Entity extraction
const withEntities = detectIntent(
  'My PNR sk4821x flight sk-118 was delayed; refund to a different card, waive ₹1,500'
);
check(
  'entities: pnr/flight/payment/waiver extracted',
  withEntities.entities.pnr === 'SK4821X' &&
    withEntities.entities.flightNumber === 'SK-118' &&
    withEntities.entities.paymentMethod === 'different' &&
    withEntities.entities.waiverAmountInr === 1500
);

// ---------------------------------------------------------------------------
// 2. Action executor — allowed & policy-gated
// ---------------------------------------------------------------------------

console.log('\n=== 2. Action executor (simulated) ===');

// Reset audit file for a clean run
const auditFile = resolveAuditFile();
const originalAudit = readFileSync(auditFile, 'utf-8');
writeFileSync(auditFile, '[]\n', 'utf-8');

const priyaRefund: ExecutedAction = executeAction({
  pnr: 'SK4821X',
  action: 'initiate_refund',
  reason: 'Airline-caused cancellation; full refund requested',
});
check('refund (Priya, airline-caused) -> completed + simulated + full record',
  priyaRefund.status === 'completed' &&
    priyaRefund.simulated === true &&
    priyaRefund.pnr === 'SK4821X' &&
    priyaRefund.id.length > 0 &&
    !Number.isNaN(Date.parse(priyaRefund.timestamp)));

const priyaRebook: ExecutedAction = executeAction({
  pnr: 'sk4821x', // case-insensitive
  action: 'request_rebooking',
  reason: 'Free rebooking within 24h after airline-caused cancellation',
});
check('rebooking (case-insensitive PNR) -> completed', priyaRebook.status === 'completed');

const arvindVoucher: ExecutedAction = executeAction({
  pnr: 'TR1190B',
  action: 'issue_meal_voucher',
  reason: '4h delay: meal voucher entitlement',
});
check('meal voucher (Arvind 4h delay) -> completed', arvindVoucher.status === 'completed');

const arvindLounge: ExecutedAction = executeAction({
  pnr: 'TR1190B',
  action: 'issue_lounge_access',
  reason: '4h delay: lounge entitlement',
});
check('lounge (Arvind 4h delay) -> completed', arvindLounge.status === 'completed');

const arvindHotel: ExecutedAction = executeAction({
  pnr: 'TR1190B',
  action: 'arrange_delayed_hours_hotel',
  reason: 'hotel for 4h delay',
});
check('hotel (Arvind 4h delay) -> REFUSED (policy: hotel needs >5h)',
  arvindHotel.status === 'failed' && arvindHotel.reason.includes('policy'));

const meherHotel: ExecutedAction = executeAction({
  pnr: 'WL7742',
  action: 'arrange_delayed_hours_hotel',
  reason: '6h delay: delayed-hours hotel entitlement',
});
check('hotel (Meher 6h delay) -> completed (delayed hours only)',
  meherHotel.status === 'completed');

const voucherOnUnaffected: ExecutedAction = executeAction({
  pnr: 'SK4821X',
  action: 'issue_meal_voucher',
  reason: 'no delay here',
});
check('voucher on unaffected booking -> REFUSED (no delay)',
  voucherOnUnaffected.status === 'failed');

// Every record has the required fields
const allExecuted = [priyaRefund, priyaRebook, arvindVoucher, arvindLounge, arvindHotel, meherHotel, voucherOnUnaffected];
check('every executed action has id/pnr/action/status/timestamp/reason/simulated',
  allExecuted.every(
    (a) =>
      a.id.length > 0 &&
      a.pnr.length > 0 &&
      a.action.length > 0 &&
      a.status.length > 0 &&
      a.timestamp.length > 0 &&
      a.reason.length > 0 &&
      a.simulated === true
  )
);
check('executed action ids are unique',
  new Set(allExecuted.map((a) => a.id)).size === allExecuted.length);

// ---------------------------------------------------------------------------
// 3. Escalation handler
// ---------------------------------------------------------------------------

console.log('\n=== 3. Escalation handler ===');

const cases: Array<{ trigger: Parameters<typeof escalate>[0]; priority: string; label: string }> = [
  { trigger: 'legal_threat', priority: 'high', label: 'legal threat -> high' },
  { trigger: 'formal_complaint', priority: 'high', label: 'formal complaint -> high' },
  { trigger: 'compensation_beyond_policy', priority: 'medium', label: 'compensation beyond policy -> medium' },
  { trigger: 'fare_waiver_above_limit', priority: 'medium', label: 'fare waiver above ₹1,500 -> medium' },
  { trigger: 'refund_different_payment_method', priority: 'medium', label: 'refund to different method -> medium' },
  { trigger: 'unauthorized_exception', priority: 'high', label: 'unauthorized exception -> high' },
  { trigger: 'missing_authority', priority: 'medium', label: 'missing authority -> medium' },
  { trigger: 'unclear_request', priority: 'low', label: 'unclear request -> low' },
];

for (const testCase of cases) {
  const result = escalate(testCase.trigger, { pnr: 'sk4821x' });
  check(testCase.label,
    result.required === true &&
      result.status === 'escalated_to_human' &&
      result.priority === testCase.priority &&
      result.pnr === 'SK4821X' &&
      result.reason.length > 0);
}

const none = noEscalation();
check('noEscalation() -> required false, uniform shape',
  none.required === false && none.status === 'no_escalation');

// ---------------------------------------------------------------------------
// 4. Audit service
// ---------------------------------------------------------------------------

console.log('\n=== 4. Audit service ===');

const audit1 = createAuditRecord({
  pnr: 'SK4821X',
  customer: 'Priya Nair',
  intent: 'refund_request',
  policyUsed: ['Supplied Service Rules - Cancellation Rule', 'Supplied Service Rules - Refund Rule'],
  decision: 'Eligible: full refund to original payment method within 7 business days.',
  actions: [priyaRefund],
  escalation: null,
});

const audit2 = createAuditRecord({
  pnr: 'WL7742',
  customer: 'Meher Kaur',
  intent: 'hotel_request',
  policyUsed: ['Supplied Service Rules - Delay Compensation Rule'],
  decision: 'Eligible: hotel for delayed hours only (delay exceeds 5 hours).',
  actions: [meherHotel],
  escalation: escalate('fare_waiver_above_limit', { pnr: 'WL7742' }),
});

const audit3 = createAuditRecord({
  pnr: 'TR1190B',
  customer: 'Arvind Kulkarni',
  intent: 'meal_voucher_request',
  policyUsed: ['Supplied Service Rules - Delay Compensation Rule'],
  decision: 'Eligible: meal voucher and lounge access (delay exceeds 3 hours).',
  actions: [arvindVoucher, arvindLounge],
});

check('createAuditRecord returns contract shape',
  audit1.id.length > 0 &&
    audit1.pnr === 'SK4821X' &&
    audit1.customer === 'Priya Nair' &&
    audit1.intent === 'refund_request' &&
    audit1.policyUsed.length === 2 &&
    audit1.decision.length > 0 &&
    audit1.actions[0] === 'initiate_refund:completed' &&
    audit1.escalation === null &&
    !Number.isNaN(Date.parse(audit1.timestamp)));

check('Meher record embeds escalation, Arvind record embeds 2 actions',
  audit2.escalation !== null &&
    audit2.escalation.includes('₹1,500') &&
    audit2.actions[0] === 'arrange_delayed_hours_hotel:completed' &&
    audit3.actions.length === 2 &&
    audit3.actions[1] === 'issue_lounge_access:completed');

check('getAuditRecordsByPnr(WL7742) -> 1 record with escalation string',
  getAuditRecordsByPnr('wl7742').length === 1 &&
    getAuditRecordsByPnr('WL7742')[0]?.escalation?.includes('₹1,500') === true);

check('getAuditRecordsByPnr(UNKNOWN1) -> []',
  getAuditRecordsByPnr('UNKNOWN1').length === 0);

const allRecords = getAllAuditRecords();
check('getAllAuditRecords -> 3 records persisted',
  allRecords.length === 3);

// Persistence round-trip: the file on disk must parse as valid JSON with 3 records
const onDisk = JSON.parse(readFileSync(auditFile, 'utf-8')) as unknown[];
check('audit-logs.json on disk contains 3 valid records', onDisk.length === 3);

// ---------------------------------------------------------------------------
// Cleanup: restore empty audit log (seed state)
// ---------------------------------------------------------------------------

rmSync(auditFile, { force: true });
writeFileSync(auditFile, originalAudit, 'utf-8');

console.log('\n──────────────────────────────');
if (failures === 0) {
  console.log('✅ ALL AGENT-SUPPORT CHECKS PASSED');
  process.exit(0);
} else {
  console.error(`❌ ${failures} check(s) FAILED`);
  process.exit(1);
}
