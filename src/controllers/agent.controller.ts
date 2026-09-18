/**
 * Agent endpoints.
 * Thin HTTP layer only: zod validation + response shaping. Business decisions
 * come exclusively from the orchestrator/policy engine.
 */

import type { Request, Response } from 'express';

import { executeAction } from '../agents/action.executor';
import { escalate } from '../agents/escalation.handler';
import {
  getAgentInfo,
  handleChatMessage,
} from '../agents/agent.orchestrator';

import { AUTHORIZATION_ACTION_MAP } from '../types';
import { appendActionLog } from '../data/store';

import {
  chatRequestSchema,
  escalationSchema,
  executeActionSchema,
  parseOrThrow,
} from '../middleware/validation.middleware';

import { notFoundError } from '../middleware/error.middleware';

import { findCustomerByPnr } from '../data/store';

/** POST /api/agent/chat — run one agent turn. */
export async function postAgentChat(req: Request, res: Response): Promise<void> {
  const { pnr, message } = parseOrThrow(chatRequestSchema, req.body);

  const result = await handleChatMessage({ message, pnr });

  res.status(200).json({
    success: true,
    data: {
      message: result.message,
      intent: result.intent,
      customer: result.customer,
      booking: result.booking,
      policyUsed: result.policyUsed,
      decision: result.decision,
      actions: result.actions,
      escalation: result.escalation,
      auditId: result.auditId,
      llmUsed: result.llmUsed,
    },
  });
}

/** POST /api/actions/execute — policy-gated simulated execution. */
export function postActionExecute(req: Request, res: Response): void {
  const input = parseOrThrow(executeActionSchema, req.body);
  const { pnr, action, reason } = input;

  // Unknown PNR is a client error, not a policy refusal.
  if (!findCustomerByPnr(pnr)) {
    throw notFoundError(`No customer found for PNR ${pnr}.`);
  }

  const record = executeAction({ pnr, action, reason });

  // Persist to the append-only action log (zod-validated in the store).
  // Vocabulary is mapped to the data-layer action/status enums.
  appendActionLog({
    id: record.id,
    timestamp: record.timestamp,
    pnr: record.pnr,
    action: AUTHORIZATION_ACTION_MAP[action],
    status: record.status === 'completed' ? 'succeeded' : 'failed',
    details: record.reason,
  });

  // 201: the request was processed; policy refusals appear as status 'failed'
  // with the policy reason — they are valid, auditable outcomes.
  res.status(201).json({ success: true, data: record });
}

/** POST /api/escalations — create a human escalation. */
export function postEscalation(req: Request, res: Response): void {
  const { trigger, pnr } = parseOrThrow(escalationSchema, req.body);

  const result = escalate(trigger, pnr ? { pnr } : undefined);

  res.status(201).json({ success: true, data: result });
}

/** GET /api/agent — agent metadata (LLM availability, model, endpoints). */
export function getAgentMeta(_req: Request, res: Response): void {
  res.status(200).json({ success: true, data: getAgentInfo() });
}
