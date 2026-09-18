/**
 * LLM service (Groq).
 * The LLM is a PHRASER ONLY: it may make deterministic policy decisions sound
 * empathetic and human, but it never decides eligibility, never invents
 * policy, flights, or customer data. All business truth comes from the policy
 * engine; this service receives the final decision and asks the model to
 * reword it.
 *
 * Failure policy: any problem (missing key, timeout, API error, empty reply)
 * resolves to { used: false } so the orchestrator can fall back to the
 * deterministic response. This service never throws.
 */

import Groq from 'groq-sdk';

import { env } from '../config/env';

/** Seconds before the LLM call is abandoned in favor of fallback. */
const LLM_TIMEOUT_SECONDS = 10;

export interface LlmPhraseResult {
  /** true when the reply text came from the LLM; false when fallback should be used. */
  used: boolean;
  /** LLM-generated text (only when used === true). */
  text?: string;
  /** Machine-readable reason when the LLM was not used. */
  reason?: 'no_api_key' | 'timeout' | 'api_error' | 'empty_reply';
}

let client: Groq | null = null;

/**
 * Ops kill-switch: set LLM_DISABLED=1 to force deterministic fallback mode
 * (used by verification scripts and for incident response).
 */
function isLlmDisabled(): boolean {
  return process.env.LLM_DISABLED === '1';
}

function getClient(): Groq | null {
  if (!env.groqApiKey || isLlmDisabled()) return null;
  if (!client) {
    client = new Groq({ apiKey: env.groqApiKey, timeout: LLM_TIMEOUT_SECONDS * 1000 });
  }
  return client;
}

/** True when the LLM can be called; the server works fully without it. */
export function isLlmAvailable(): boolean {
  return Boolean(env.groqApiKey) && !isLlmDisabled();
}

/**
 * Strict system prompt: rephrase the deterministic decision. The model is
 * instructed to treat the decision block as the ONLY source of truth.
 */
const PHRASER_SYSTEM_PROMPT = `You are the voice of an airline customer-support agent.
You will receive a structured DECISION produced by a deterministic policy engine.
Your ONLY job is to rephrase that decision into one short, empathetic customer message.

Hard rules:
- The DECISION block is the single source of truth. Never contradict it.
- Never invent policies, compensation, flights, seat availability, or customer data.
- Never approve anything the decision does not approve, and never waive fare differences.
- If the decision says something was refused or escalated, say so clearly and kindly.
- Preserve exact scope qualifiers from the decision: hotel stays are for
  'the delayed hours only', refunds go to 'the original payment method',
  rebooking is 'within 24 hours'. Never generalize or drop these limits.
- 2-5 sentences, plain language, no markdown, no bullet lists.
- Output ONLY the customer-facing message text.`;

/**
 * Ask Groq to rephrase a deterministic decision into customer language.
 * Resolves with { used: false, reason } on any failure — callers should fall
 * back to the deterministic text.
 */
export async function phraseDecision(options: {
  /** Deterministic response text (the fallback and the phrasing source). */
  fallbackText: string;
  /** Compact decision summary shown to the model as ground truth. */
  decisionSummary: string;
  /** Recent conversation turns for tone continuity (optional). */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<LlmPhraseResult> {
  const groq = getClient();
  if (!groq) {
    return { used: false, reason: 'no_api_key' };
  }

  const userContent = [
    `DECISION (source of truth):`,
    options.decisionSummary,
    ``,
    `DRAFT RESPONSE to rephrase:`,
    options.fallbackText,
  ].join('\n');

  try {
    const completion = await groq.chat.completions.create(
      {
        model: env.groqModel,
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          { role: 'system', content: PHRASER_SYSTEM_PROMPT },
          ...(options.history ?? []).slice(-4),
          { role: 'user', content: userContent },
        ],
      },
      { timeout: LLM_TIMEOUT_SECONDS * 1000 }
    );

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return { used: false, reason: 'empty_reply' };
    }
    return { used: true, text };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === 'APIConnectionTimeoutError' || /timeout/i.test(err.message));
    return {
      used: false,
      reason: isTimeout ? 'timeout' : 'api_error',
    };
  }
}
