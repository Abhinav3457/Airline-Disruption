/**
 * Agent controller.
 * Thin HTTP layer: request validation (zod) + response shaping only.
 * All business logic lives in the orchestrator/policy engine — no policy
 * decisions happen here.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';

import {
  getAgentInfo,
  handleChatMessage,
} from '../agents/agent.orchestrator';

const chatRequestSchema = z.object({
  body: z.object({
    /** Booking reference. Optional: the agent asks for it when missing. */
    pnr: z.string().trim().min(1).optional(),
    /** Free-text customer message. Required. */
    message: z.string().trim().min(1, 'message is required'),
  }),
});

/** POST /api/agent/chat — run one agent turn. */
export async function postAgentChat(req: Request, res: Response): Promise<void> {
  const parsed = chatRequestSchema.safeParse({ body: req.body });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body.',
        issues,
      },
    });
    return;
  }

  const { pnr, message } = parsed.data.body;

  try {
    const result = await handleChatMessage({
      message,
      pnr,
      history: [],
    });

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
  } catch (err) {
    console.error('Agent chat failed:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'AGENT_FAILURE',
        message: 'The agent could not process this request. Please try again.',
      },
    });
  }
}

/** GET /api/agent — agent metadata (LLM availability, model, endpoints). */
export function getAgentMeta(_req: Request, res: Response): void {
  res.status(200).json({ success: true, data: getAgentInfo() });
}
