/**
 * Agent conversation types (contracts only — agent logic comes later).
 */

import type { Booking } from './booking.types';
import type { Customer } from './customer.types';
import type { AllowedActionId } from './policy.types';

export type MessageRole = 'system' | 'user' | 'assistant';

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

/** Everything the agent needs to resolve one conversation. */
export interface AgentContext {
  /** Resolved customer, or null while unidentified. */
  customer: Customer | null;
  bookings: Booking[];
  history: ConversationMessage[];
}

export interface AgentReply {
  message: string;
  actionsTaken: AllowedActionId[];
  requiresEscalation: boolean;
  escalationReason?: string;
}
