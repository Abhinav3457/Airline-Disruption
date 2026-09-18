/**
 * Typed services for the existing backend endpoints.
 * Endpoint paths are relative to VITE_API_BASE_URL (…/api).
 */

import { apiGet, apiPost } from './apiClient';

import type {
  AllPolicies,
  AuditRecord,
  Booking,
  ChatData,
  ChatRequest,
  Customer,
  CustomerProfile,
  HealthInfo,
} from '@/types';

// GET /health ----------------------------------------------------------------

export function getHealth(timeoutMs?: number): Promise<HealthInfo> {
  return apiGet<HealthInfo>('/health', timeoutMs);
}

// GET /customers · GET /customers/:pnr ---------------------------------------

export function getCustomers(): Promise<Customer[]> {
  return apiGet<Customer[]>('/customers');
}

export function getCustomerByPnr(pnr: string): Promise<CustomerProfile> {
  return apiGet<CustomerProfile>(`/customers/${encodeURIComponent(pnr)}`);
}

// GET /bookings/:pnr ----------------------------------------------------------

export function getBookingsByPnr(pnr: string): Promise<Booking[]> {
  return apiGet<Booking[]>(`/bookings/${encodeURIComponent(pnr)}`);
}

// GET /policies ---------------------------------------------------------------

export function getPolicies(): Promise<AllPolicies> {
  return apiGet<AllPolicies>('/policies');
}

// POST /agent/chat ------------------------------------------------------------

/**
 * One agent turn. Uses a longer timeout because the backend may wait on the
 * LLM (up to 10 s) before falling back to the deterministic reply.
 */
export function postAgentChat(request: ChatRequest): Promise<ChatData> {
  return apiPost<ChatData>('/agent/chat', request, 30_000);
}

// GET /audit · GET /audit/:pnr ------------------------------------------------

export function getAuditRecords(): Promise<AuditRecord[]> {
  return apiGet<AuditRecord[]>('/audit');
}

export function getAuditByPnr(pnr: string): Promise<AuditRecord[]> {
  return apiGet<AuditRecord[]>(`/audit/${encodeURIComponent(pnr)}`);
}
