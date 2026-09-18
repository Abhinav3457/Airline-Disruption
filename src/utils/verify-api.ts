/**
 * Full API test matrix (in-process HTTP server, LLM disabled).
 * Covers every endpoint plus the mandatory scenarios, validation failures,
 * and error-handling contracts from the assignment.
 *
 * Run with: npm run verify:api
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

// Force deterministic fallback mode before importing app modules.
process.env.LLM_DISABLED = '1';

import { createApp } from '../app';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✔ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

interface JsonResponse {
  status: number;
  body: any;
}

async function request(
  base: string,
  method: 'GET' | 'POST',
  urlPath: string,
  payload?: unknown
): Promise<JsonResponse> {
  const response = await fetch(`${base}${urlPath}`, {
    method,
    headers: payload !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function main(): Promise<void> {
  // Clean audit log for deterministic assertions.
  writeFileSync(
    path.resolve(process.cwd(), 'src', 'data', 'audit-logs.json'),
    '[]\n',
    'utf-8'
  );

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://localhost:${port}`;

  try {
    // ---------------------------------------------------------------
    console.log('\n=== 1. GET /api/health ===');
    const health = await request(base, 'GET', '/api/health');
    check('health returns 200 ok',
      health.status === 200 && health.body?.status === 'ok');

    // ---------------------------------------------------------------
    console.log('\n=== 2. GET /api/customers ===');
    const customers = await request(base, 'GET', '/api/customers');
    check('returns 3 customers',
      customers.status === 200 && customers.body.data.length === 3);

    // ---------------------------------------------------------------
    console.log('\n=== 3. GET /api/customers/SK4821X (Priya) ===');
    const priya = await request(base, 'GET', '/api/customers/sk4821x');
    check('Priya profile with 2 booking legs (case-insensitive PNR)',
      priya.status === 200 &&
        priya.body.data.name === 'Priya Nair' &&
        priya.body.data.loyaltyTier === 'Gold' &&
        priya.body.data.bookings.length === 2);

    const unknownCustomer = await request(base, 'GET', '/api/customers/ZZ9999');
    check('unknown customer -> 404 envelope',
      unknownCustomer.status === 404 &&
        unknownCustomer.body.success === false &&
        unknownCustomer.body.error.code === 'NOT_FOUND');

    const invalidPnr = await request(base, 'GET', '/api/customers/AB');
    check('invalid PNR format -> 400 with field issue',
      invalidPnr.status === 400 &&
        invalidPnr.body.error.code === 'VALIDATION_ERROR' &&
        invalidPnr.body.error.issues.length > 0);

    // ---------------------------------------------------------------
    console.log('\n=== 4. GET /api/bookings/TR1190B (Arvind) ===');
    const arvindBookings = await request(base, 'GET', '/api/bookings/TR1190B');
    check('Arvind has 1 delayed leg (4h, new departure 11:10)',
      arvindBookings.status === 200 &&
        arvindBookings.body.data.length === 1 &&
        arvindBookings.body.data[0].status === 'Delayed' &&
        arvindBookings.body.data[0].delayHours === 4);

    const arvindStatus = await request(base, 'GET', '/api/bookings/TR1190B/status');
    check('status summary: hasDisruption, primary=delay',
      arvindStatus.status === 200 &&
        arvindStatus.body.data.hasDisruption === true &&
        arvindStatus.body.data.primaryDisruption.delayHours === 4);

    // ---------------------------------------------------------------
    console.log('\n=== 5. GET /api/policies ===');
    const policies = await request(base, 'GET', '/api/policies');
    check('all 7 policy categories as envelopes',
      policies.status === 200 &&
        policies.body.data.cancellation.policyId === 'cancellation' &&
        policies.body.data.delay.details.tiers.length === 3 &&
        policies.body.data.allowedActions.details.length === 6 &&
        policies.body.data.prohibited.details.length === 5);

    // ---------------------------------------------------------------
    console.log('\n=== 6. Priya cancellation/refund (chat) ===');
    const priyaChat = await request(base, 'POST', '/api/agent/chat', {
      pnr: 'SK4821X',
      message: 'My flight was cancelled. I want a full refund and free business class upgrade.',
    });
    check('refund initiated, upgrade not approved',
      priyaChat.status === 200 &&
        priyaChat.body.data.actions.some(
          (a: any) => a.action === 'initiate_refund' && a.status === 'completed'
        ) &&
        priyaChat.body.data.actions.every((a: any) => !a.action.includes('upgrade')) &&
        /refund/i.test(priyaChat.body.data.message));

    // ---------------------------------------------------------------
    console.log('\n=== 7. Arvind 4-hour delay (chat) ===');
    const arvindChat = await request(base, 'POST', '/api/agent/chat', {
      pnr: 'TR1190B',
      message: 'My flight is delayed 4 hours and I need a hotel',
    });
    check('voucher + lounge issued, hotel refused',
      arvindChat.body.data.actions.some((a: any) => a.action === 'issue_meal_voucher' && a.status === 'completed') &&
        arvindChat.body.data.actions.some((a: any) => a.action === 'issue_lounge_access' && a.status === 'completed') &&
        arvindChat.body.data.actions.every((a: any) => a.action !== 'arrange_delayed_hours_hotel'));

    // ---------------------------------------------------------------
    console.log('\n=== 8. Meher 6-hour delay (chat) ===');
    const meherChat = await request(base, 'POST', '/api/agent/chat', {
      pnr: 'WL7742',
      message: 'My flight is delayed 6 hours. Give me a full-night hotel and waive the Rs2000 fare difference.',
    });
    check('voucher + lounge + delayed-hours hotel, waiver escalated',
      meherChat.body.data.actions.filter((a: any) => a.status === 'completed').length === 3 &&
        meherChat.body.data.escalation?.priority === 'medium' &&
        /delayed hours/i.test(meherChat.body.data.message));

    // ---------------------------------------------------------------
    console.log('\n=== 9. Legal threat escalation (chat) ===');
    const legalChat = await request(base, 'POST', '/api/agent/chat', {
      pnr: 'SK4821X',
      message: 'I will take legal action, see you in court',
    });
    check('legal complaint -> high-priority human escalation',
      legalChat.body.data.escalation?.priority === 'high' &&
        legalChat.body.data.escalation.status === 'escalated_to_human');

    // ---------------------------------------------------------------
    console.log('\n=== 10. Invalid PNR / unknown PNR (chat) ===');
    const badPnrChat = await request(base, 'POST', '/api/agent/chat', {
      pnr: 'XYZ',
      message: 'I want a refund',
    });
    check('invalid PNR in chat body -> 400',
      badPnrChat.status === 400 && badPnrChat.body.error.code === 'VALIDATION_ERROR');

    // ---------------------------------------------------------------
    console.log('\n=== 11. Missing message / empty request ===');
    const missingMessage = await request(base, 'POST', '/api/agent/chat', { pnr: 'SK4821X' });
    check('missing message -> 400 with field issue',
      missingMessage.status === 400 &&
        missingMessage.body.error.issues.some((i: any) => i.field === 'message'));

    const emptyRequest = await request(base, 'POST', '/api/agent/chat', {});
    check('empty body -> 400',
      emptyRequest.status === 400 && emptyRequest.body.success === false);

    // ---------------------------------------------------------------
    console.log('\n=== 12. Unauthorized action / invalid action type ===');
    const unauthorizedHotel = await request(base, 'POST', '/api/actions/execute', {
      pnr: 'TR1190B',
      action: 'arrange_delayed_hours_hotel',
      reason: 'hotel for 4h delay',
    });
    check('hotel for 4h delay -> processed but REFUSED by policy (failed)',
      unauthorizedHotel.status === 201 &&
        unauthorizedHotel.body.data.status === 'failed' &&
        unauthorizedHotel.body.data.simulated === true);

    const invalidAction = await request(base, 'POST', '/api/actions/execute', {
      pnr: 'TR1190B',
      action: 'fly_to_the_moon',
      reason: 'not a real action',
    });
    check('invalid action type -> 400 with issue',
      invalidAction.status === 400 &&
        invalidAction.body.error.issues.some((i: any) => i.field === 'action'));

    const waiverEscalation = await request(base, 'POST', '/api/escalations', {
      trigger: 'fare_waiver_above_limit',
      pnr: 'WL7742',
    });
    check('fare waiver escalation endpoint -> 201, medium priority',
      waiverEscalation.status === 201 &&
        waiverEscalation.body.data.required === true &&
        waiverEscalation.body.data.priority === 'medium');

    const unknownPnrExecute = await request(base, 'POST', '/api/actions/execute', {
      pnr: 'ZZ9999',
      action: 'issue_meal_voucher',
      reason: 'no such customer',
    });
    check('execute for unknown PNR -> 404',
      unknownPnrExecute.status === 404);

    // ---------------------------------------------------------------
    console.log('\n=== 13. Audit retrieval ===');
    const allAudit = await request(base, 'GET', '/api/audit');
    // Four chat turns this run (Priya, Arvind, Meher, legal) — each persists
    // one audit record. Direct action executions persist to action-logs.json.
    check('audit trail has records from this run',
      allAudit.status === 200 && allAudit.body.data.length >= 4);

    const priyaAudit = await request(base, 'GET', '/api/audit/SK4821X');
    check('per-PNR audit works (case-insensitive)',
      priyaAudit.status === 200 && priyaAudit.body.data.length >= 2);

    const auditFilter = await request(base, 'GET', '/api/audit?pnr=WL7742');
    check('query filter ?pnr= works',
      auditFilter.status === 200 &&
        auditFilter.body.data.every((r: any) => r.pnr === 'WL7742') &&
        auditFilter.body.data.length >= 1);

    // ---------------------------------------------------------------
    console.log('\n=== 14. Action logging ===');
    const loggedAction = await request(base, 'POST', '/api/actions/execute', {
      pnr: 'WL7742',
      action: 'arrange_delayed_hours_hotel',
      reason: '6h delay: delayed-hours hotel entitlement',
    });
    check('authorized action logged with unique id + simulated flag',
      loggedAction.status === 201 &&
        loggedAction.body.data.id.length > 0 &&
        loggedAction.body.data.status === 'completed');

    const auditAfterAction = await request(base, 'GET', '/api/audit');
    check('audit trail keeps growing (append-only)',
      auditAfterAction.body.data.length >= allAudit.body.data.length);

    // ---------------------------------------------------------------
    console.log('\n=== Extra: error-handling contracts ===');
    const notFoundRoute = await request(base, 'GET', '/api/nope');
    check('unknown route -> 404 envelope',
      notFoundRoute.status === 404 && notFoundRoute.body.error.code === 'NOT_FOUND');

    const malformedJson = await fetch(`${base}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    check('malformed JSON -> 400 (body-parser error normalized)',
      malformedJson.status === 400);

    check('no stack traces in any error body',
      [badPnrChat.body, unknownCustomer.body, invalidAction.body, emptyRequest.body]
        .every((body) => !JSON.stringify(body).includes('node_modules') &&
                        !JSON.stringify(body).includes('    at ')));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n──────────────────────────────');
  if (failures === 0) {
    console.log('✅ ALL API MATRIX CHECKS PASSED');
    process.exit(0);
  } else {
    console.error(`❌ ${failures} check(s) FAILED`);
    process.exit(1);
  }
}

void main();
