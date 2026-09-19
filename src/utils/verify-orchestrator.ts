/**
 * Orchestrator + chat API verification (fallback mode, no LLM calls).
 * Covers the three mandatory scenarios plus legal threat, unknown PNR,
 * missing message validation, unknown intent, and audit persistence.
 *
 * Run with: npm run verify:chat
 */

import { handleChatMessage } from '../agents/agent.orchestrator';

// Force deterministic fallback mode: verification must not depend on live LLM phrasing.
process.env.LLM_DISABLED = '1';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✔ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Original audit-log contents, captured before reset so runs never wipe demo history. */
const auditBackups = new Map<string, string>();

function resetAuditLog(): void {
  // The orchestrator persists audit records; start each run from a clean slate.
  // (audit.service resolves src/data or dist/data the same way the store does.)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { existsSync, readFileSync, writeFileSync } = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');
  for (const dir of ['src', 'dist']) {
    // dist/ does not exist on a fresh clone (before `npm run build`) — skip
    // it instead of crashing; the store falls back to src/data anyway.
    const dataDir = path.resolve(process.cwd(), dir, 'data');
    if (!existsSync(dataDir)) continue;
    const file = path.join(dataDir, 'audit-logs.json');
    if (!existsSync(file)) continue;
    if (!auditBackups.has(file)) {
      auditBackups.set(file, readFileSync(file, 'utf-8'));
    }
    writeFileSync(file, '[]\n', 'utf-8');
  }
}

function restoreAuditLogs(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writeFileSync } = require('node:fs') as typeof import('node:fs');
  for (const [file, contents] of auditBackups) {
    writeFileSync(file, contents, 'utf-8');
  }
  auditBackups.clear();
}

async function main(): Promise<void> {
resetAuditLog();

// ---------------------------------------------------------------------------
// 1. PRIYA — refund yes, upgrade no, no invented perks
// ---------------------------------------------------------------------------

console.log('\n=== 1. Priya (SK4821X): refund + upgrade ask ===');

const priya = await handleChatMessage({
  pnr: 'SK4821X',
  message: 'My flight was cancelled. I want a full refund and free business class upgrade.',
});

check('refund initiated (simulated, completed)',
  priya.actions.some((a) => a.action === 'initiate_refund' && a.status === 'completed'));
check('upgrade NOT approved',
  !priya.decision.eligibleActions.includes('waive_fare_difference') &&
    priya.actions.every((a) => !a.action.includes('upgrade')));
check('reply explicitly refuses the upgrade (not silently dropped)',
  /upgrade/i.test(priya.message));
check('policy explanation references refund/upgrades',
  /refund/i.test(priya.message) || /upgrade/i.test(priya.message));
check('no invented data: decision is policy-grounded',
  priya.decision.policySources.every((s) => s.startsWith('Supplied Service Rules')));
check('intent classified as refund_request (refund beats upgrade)',
  priya.intent === 'refund_request');
check('audit record created', priya.auditId.length > 0);

const priyaRebook = await handleChatMessage({
  pnr: 'SK4821X',
  message: 'Please rebook me on the next available flight',
});
check('rebooking also works (Gold priority source added)',
  priyaRebook.actions.some((a) => a.action === 'request_rebooking' && a.status === 'completed') &&
    priyaRebook.policyUsed.some((s) => s.includes('Loyalty')));

// ---------------------------------------------------------------------------
// 2. ARVIND — 4h delay: voucher + lounge, NO hotel
// ---------------------------------------------------------------------------

console.log('\n=== 2. Arvind (TR1190B): 4h delay, hotel ask ===');

const arvind = await handleChatMessage({
  pnr: 'TR1190B',
  message: 'My flight is delayed 4 hours and I need a hotel',
});

check('meal voucher issued', arvind.actions.some((a) => a.action === 'issue_meal_voucher' && a.status === 'completed'));
check('lounge access issued', arvind.actions.some((a) => a.action === 'issue_lounge_access' && a.status === 'completed'));
check('hotel NOT issued', arvind.actions.every((a) => a.action !== 'arrange_delayed_hours_hotel'));
check('clear explanation mentions hotel rules',
  /hotel/i.test(arvind.message) || /5 hours/i.test(arvind.message));
check('intent detected as hotel_request', arvind.intent === 'hotel_request');
check('hotel refusal explicit in decision (partially_eligible + ineligibleActions)',
  arvind.decision.status === 'partially_eligible' &&
    arvind.decision.ineligibleActions.includes('arrange_delayed_hours_hotel'));
check('reply states the >5h hotel threshold (no implied hotel)',
  /more than 5 hours/i.test(arvind.message));

// ---------------------------------------------------------------------------
// 3. MEHER — 6h delay: voucher + lounge + delayed-hours hotel, waiver escalation
// ---------------------------------------------------------------------------

console.log('\n=== 3. Meher (WL7742): 6h delay + full-night hotel + ₹2,000 waiver ===');

const meher = await handleChatMessage({
  pnr: 'WL7742',
  message: 'My flight is delayed 6 hours. Give me a full-night hotel and waive the ₹2000 fare difference.',
});

check('meal voucher issued', meher.actions.some((a) => a.action === 'issue_meal_voucher' && a.status === 'completed'));
check('lounge access issued', meher.actions.some((a) => a.action === 'issue_lounge_access' && a.status === 'completed'));
check('delayed-hours hotel issued', meher.actions.some((a) => a.action === 'arrange_delayed_hours_hotel' && a.status === 'completed'));
check('escalation required (₹2,000 waiver)', meher.escalation !== null && meher.decision.requiresEscalation);
check('escalation reason mentions supervisor/₹1,500',
  meher.escalation?.reason.includes('₹1,500') === true ||
    meher.escalation?.reason.includes('supervisor') === true);
check('delayed-hours only wording present', /delayed hours/i.test(meher.message));
check('intent classified as hotel_request with waiver entity',
  meher.intent === 'hotel_request');

// ---------------------------------------------------------------------------
// 4. Edge cases
// ---------------------------------------------------------------------------

console.log('\n=== 4. Edge cases ===');

const legal = await handleChatMessage({
  pnr: 'SK4821X',
  message: 'I will take legal action, see you in court',
});
check('legal threat -> escalated to human (high priority)',
  legal.escalation !== null &&
    legal.escalation.priority === 'high' &&
    legal.decision.status === 'escalation_required');

const unknownPnr = await handleChatMessage({
  pnr: 'ZZ9999',
  message: 'I want a refund',
});
check('unknown PNR -> clarification, no customer data invented',
  unknownPnr.customer === null &&
    unknownPnr.decision.status === 'clarification_required' &&
    unknownPnr.actions.length === 0);

const noPnr = await handleChatMessage({
  message: 'I want a refund please',
});
check('missing PNR -> asks for booking reference',
  noPnr.customer === null && /PNR|reference/i.test(noPnr.message));

const gibberish = await handleChatMessage({
  pnr: 'TR1190B',
  message: 'asdf qwerty',
});
check('unknown intent -> clarification question',
  gibberish.intent === 'unknown' && gibberish.decision.status === 'clarification_required');

const usSpelling = await handleChatMessage({
  pnr: 'SK4821X',
  message: 'my flight got canceled, what are my options?',
});
check('US spelling "canceled" -> cancellation_support',
  usSpelling.intent === 'cancellation_support');

const status = await handleChatMessage({
  pnr: 'TR1190B',
  message: 'What is the status of my flight?',
});
check('flight status -> eligible with booking details',
  status.decision.status === 'eligible' &&
    status.booking !== null &&
    status.booking.status === 'Delayed');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

restoreAuditLogs();

console.log('\n──────────────────────────────');
if (failures === 0) {
  console.log('✅ ALL ORCHESTRATOR CHECKS PASSED (fallback mode, no LLM)');
  process.exit(0);
} else {
  console.error(`❌ ${failures} check(s) FAILED`);
  process.exit(1);
}
}

void main();
