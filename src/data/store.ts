/**
 * Typed data-loading layer.
 * Loads and validates the seed JSON files once, then serves typed lookups.
 * Action logs are read/written on demand because they grow at runtime.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { z, type ZodType } from 'zod';

import type {
  ActionLog,
  AuditRecord,
  Booking,
  Customer,
  PolicyDocument,
} from '../types';

import {
  actionLogSchema,
  actionLogsSchema,
  auditRecordSchema,
  auditLogsSchema,
  bookingsSchema,
  customersSchema,
  policyDocumentSchema,
} from './schemas';const DATA_FILES = {
  customers: 'customers.json',
  bookings: 'bookings.json',
  policies: 'policies.json',
  actionLogs: 'action-logs.json',
  auditLogs: 'audit-logs.json',
} as const;

/**
 * Resolve the data directory: tsx runs from src/, compiled output runs from
 * dist/ (with JSON copied there by the build script).
 */
function resolveDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src', 'data'),
    path.resolve(process.cwd(), 'dist', 'data'),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, DATA_FILES.customers))) return dir;
  }
  throw new Error(
    `Seed data directory not found. Looked in:\n  ${candidates.join('\n  ')}`
  );
}

function loadJsonFile<T>(filePath: string, schema: ZodType<T>): T {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read data file ${filePath}: ${String(err)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${String(err)}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Data validation failed for ${filePath}:\n${z.prettifyError(result.error)}`
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Cached seed data (customers, bookings, policies are static)
// ---------------------------------------------------------------------------

interface DataCache {
  customers: Customer[];
  bookings: Booking[];
  policies: PolicyDocument;
}

let cache: DataCache | null = null;

function getCache(): DataCache {
  if (cache) return cache;

  const dataDir = resolveDataDir();
  cache = {
    customers: loadJsonFile(
      path.join(dataDir, DATA_FILES.customers),
      customersSchema
    ),
    bookings: loadJsonFile(
      path.join(dataDir, DATA_FILES.bookings),
      bookingsSchema
    ),
    policies: loadJsonFile(
      path.join(dataDir, DATA_FILES.policies),
      policyDocumentSchema
    ),
  };
  return cache;
}

// ---------------------------------------------------------------------------
// Public typed accessors
// ---------------------------------------------------------------------------

/** All customers, ordered as defined in the assignment. */
export function getCustomers(): Customer[] {
  return getCache().customers;
}

/** All bookings, ordered as defined in the assignment. */
export function getBookings(): Booking[] {
  return getCache().bookings;
}

/** The complete policy document. */
export function getPolicies(): PolicyDocument {
  return getCache().policies;
}

/** Look up a customer by PNR. */
export function findCustomerByPnr(pnr: string): Customer | undefined {
  return getCache().customers.find(
    (customer) => customer.pnr === pnr.toUpperCase()
  );
}

/** All booking legs for a PNR (may span multiple flights). */
export function findBookingsByPnr(pnr: string): Booking[] {
  return getCache().bookings.filter(
    (booking) => booking.pnr === pnr.toUpperCase()
  );
}

// ---------------------------------------------------------------------------
// Action logs (runtime append-only audit trail)
// ---------------------------------------------------------------------------

/** Current action log entries (oldest first). */
export function getActionLogs(): ActionLog[] {
  const dataDir = resolveDataDir();
  return loadJsonFile(
    path.join(dataDir, DATA_FILES.actionLogs),
    actionLogsSchema
  );
}

/**
 * Append one validated action-log entry and persist it to disk.
 * Throws if the entry fails schema validation — invalid entries are never written.
 */
export function appendActionLog(entry: ActionLog): void {
  actionLogSchema.parse(entry); // fail fast before touching disk

  const filePath = path.join(resolveDataDir(), DATA_FILES.actionLogs);
  const logs = getActionLogs();
  logs.push(entry);
  writeFileSync(filePath, `${JSON.stringify(logs, null, 2)}\n`, 'utf-8');
}

// ---------------------------------------------------------------------------
// Audit records (runtime conversation audit trail -> audit-logs.json)
// ---------------------------------------------------------------------------

/** Current audit records (oldest first). */
export function getAuditLogs(): AuditRecord[] {
  const dataDir = resolveDataDir();
  return loadJsonFile(
    path.join(dataDir, DATA_FILES.auditLogs),
    auditLogsSchema
  );
}

/**
 * Append one validated audit record and persist it to disk.
 * Throws if the record fails schema validation — invalid audit records are
 * never written.
 */
export function appendAuditRecord(record: AuditRecord): void {
  auditRecordSchema.parse(record); // fail fast before touching disk

  const filePath = path.join(resolveDataDir(), DATA_FILES.auditLogs);
  const records = getAuditLogs();
  records.push(record);
  writeFileSync(filePath, `${JSON.stringify(records, null, 2)}\n`, 'utf-8');
}
