/**
 * Zod schemas for the seed data files.
 * Each schema is pinned to its domain interface via `ZodType<T>` so the JSON
 * shape and the TypeScript types can never drift apart silently.
 */

import { z, type ZodType } from 'zod';

import type {
  ActionLog,
  AuditRecord,
  Booking,
  Customer,
  PolicyDocument,
} from '../types';

import {
  ALLOWED_ACTION_IDS,
  LOYALTY_TIERS,
} from '../types';

const PNR_REGEX = /^[A-Z0-9]{5,8}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_REGEX = /^\+[0-9]{1,4}-[0-9x]+$/; // masked numbers like +91-98xxxxxx1

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const customerSchema: ZodType<Customer> = z.object({
  name: z.string().min(1),
  loyaltyTier: z.enum(LOYALTY_TIERS),
  pnr: z.string().regex(PNR_REGEX, 'Invalid PNR format'),
  email: z.email(),
  phone: z.string().regex(PHONE_REGEX, 'Invalid phone format'),
  travelHistory: z.object({
    flightsLast12Months: z.number().int().nonnegative(),
  }),
  previousComplaints: z.array(
    z.object({
      issue: z.string().min(1),
      resolution: z.string().min(1),
    })
  ),
});

export const customersSchema: ZodType<Customer[]> = z.array(customerSchema);

// ---------------------------------------------------------------------------
// Bookings (discriminated union on status)
// ---------------------------------------------------------------------------

const bookingBaseShape = {
  pnr: z.string().regex(PNR_REGEX, 'Invalid PNR format'),
  flight: z.string().min(1),
  route: z.object({
    from: z.string().min(1),
    to: z.string().min(1),
  }),
  date: z.string().regex(ISO_DATE_REGEX, 'Date must be YYYY-MM-DD'),
  scheduledDeparture: z.string().regex(TIME_REGEX, 'Time must be HH:MM'),
};

export const bookingSchema: ZodType<Booking> = z.discriminatedUnion(
  'status',
  [
    z.object({
      ...bookingBaseShape,
      status: z.literal('Cancelled'),
      cancellationReason: z.string().min(1),
    }),
    z.object({
      ...bookingBaseShape,
      status: z.literal('Delayed'),
      delayHours: z.number().int().positive(),
      newDeparture: z.string().regex(TIME_REGEX, 'Time must be HH:MM'),
    }),
    z.object({
      ...bookingBaseShape,
      status: z.literal('Unaffected'),
    }),
  ]
);

export const bookingsSchema: ZodType<Booking[]> = z.array(bookingSchema);

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export const policyDocumentSchema: ZodType<PolicyDocument> = z.object({
  cancellation: z.object({
    options: z.array(z.string().min(1)).length(2),
  }),
  delay: z.object({
    tiers: z
      .array(
        z.object({
          condition: z.string().min(1),
          upToHours: z.number().int().positive().optional(),
          moreThanHours: z.number().int().positive().optional(),
          entitlements: z.array(z.string().min(1)).min(1),
        })
      )
      .length(3),
  }),
  refund: z.object({
    type: z.string().min(1),
    timeframe: z.string().min(1),
    method: z.string().min(1),
  }),
  fareDifference: z.object({
    rule: z.string().min(1),
    maxWaiverWithoutApprovalInr: z.number().int().positive(),
    approvalRule: z.string().min(1),
  }),
  loyalty: z.object({
    priorityRebookingTiers: z.array(z.enum(LOYALTY_TIERS)).length(2),
    additionalCompensation: z.string().min(1),
  }),
  allowedActions: z
    .array(
      z.object({
        id: z.enum(ALLOWED_ACTION_IDS),
        action: z.string().min(1),
      })
    )
    .length(6),
  prohibited: z.array(z.string().min(1)).min(1),
});

// ---------------------------------------------------------------------------
// Action logs (runtime audit trail; seed file starts empty)
// ---------------------------------------------------------------------------

export const actionLogSchema: ZodType<ActionLog> = z.object({
  id: z.uuid(),
  timestamp: z.iso.datetime({ offset: true }),
  pnr: z.string().regex(PNR_REGEX, 'Invalid PNR format'),
  action: z.enum(ALLOWED_ACTION_IDS),
  status: z.enum(['succeeded', 'failed', 'requires_approval']),
  details: z.string().min(1),
});

export const actionLogsSchema: ZodType<ActionLog[]> = z.array(actionLogSchema);

// ---------------------------------------------------------------------------
// Audit records (runtime conversation/action audit trail)
// ---------------------------------------------------------------------------

export const auditRecordSchema: ZodType<AuditRecord> = z.object({
  id: z.uuid(),
  pnr: z.string().regex(PNR_REGEX, 'Invalid PNR format'),
  customer: z.string().min(1),
  intent: z.string().min(1),
  policyUsed: z.array(z.string().min(1)),
  decision: z.string().min(1),
  actions: z.array(z.string().min(1)),
  /** null when no escalation occurred. */
  escalation: z.string().nullable(),
  timestamp: z.iso.datetime({ offset: true }),
});

export const auditLogsSchema: ZodType<AuditRecord[]> = z.array(auditRecordSchema);
