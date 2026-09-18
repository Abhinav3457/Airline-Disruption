# Airline Customer-Facing Resolution Agent — Backend

Backend for an AI-powered airline customer support resolution agent.
Built as part of an AI agent assessment.

## Tech Stack

- **Node.js** + **Express 5**
- **TypeScript** (strict mode)
- **Groq SDK** (primary LLM provider)
- **zod** (env & payload validation)
- **dotenv**, **cors**, **helmet**, **morgan**, **uuid**
- **tsx** (dev server with hot reload)

## Getting Started

### Prerequisites

- Node.js >= 20
- npm

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then set GROQ_API_KEY (get one at https://console.groq.com/keys)

# 3. Run in development (hot reload)
npm run dev

# Production
npm run build
npm start
```

## Scripts

| Script               | Description                                    |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Dev server with watch mode (tsx)               |
| `npm run build`      | Compile TypeScript to `dist/` + copy seed data |
| `npm start`          | Run compiled server from `dist/`               |
| `npm run typecheck`  | Typecheck without emitting                     |
| `npm run verify:data`     | Validate seed data against schemas & fixtures  |
| `npm run verify:services` | Exercise all service functions against fixtures |
| `npm run verify:engine`    | Test the deterministic policy engine & boundaries   |
| `npm run verify:agents`    | Test intent, executor, escalation, audit modules    |
| `npm run verify:chat`      | Test the full agent pipeline (LLM disabled)         |

## Services

- **customer.service** — `getAllCustomers`, `getCustomerByPnr` (case-insensitive),
  `getCustomerByName`, `getCustomerProfile` (customer + booking legs). Not-found
  lookups return `undefined`.
- **booking.service** — `getBookingsByPnr`, `getBookingByFlightNumber`,
  `getPrimaryDisruptedBooking` (cancellation outranks delay; longest delay wins),
  `getBookingStatus` (all legs + primary disruption summary).
- **policy.service** — every rule returned as `{ policyId, source, details }`,
  e.g. `delay_compensation` / `Supplied Service Rules - Delay Compensation Rule`.
  No rules are invented; the service only labels and exposes validated policy data.

## API Endpoints

| Method | Endpoint       | Description             |
| ------ | -------------- | ----------------------- |
| GET    | `/api/health`  | Service health check    |

### Example

```bash
curl http://localhost:5000/api/health
```

```json
{
  "status": "ok",
  "service": "airline-resolution-agent",
  "environment": "development",
  "uptimeSeconds": 3,
  "timestamp": "2026-09-18T12:00:00.000Z"
}
```

## Project Structure

```
server/
├── src/
│   ├── config/        # Environment config & constants
│   │   ├── env.ts
│   │   └── constants.ts
│   ├── data/          # Seed data + schemas + typed store
│   │   ├── customers.json    # 3 customers
│   │   ├── bookings.json     # 4 bookings
│   │   ├── policies.json     # cancellation/delay/refund/fare/loyalty rules
│   │   ├── action-logs.json  # runtime action trail (starts empty)
│   │   ├── audit-logs.json   # conversation audit trail (starts empty)
│   │   ├── schemas.ts        # zod schemas pinned to domain types
│   │   └── store.ts          # typed loaders + PNR lookups
│   ├── types/         # Shared TypeScript types (customer/booking/policy/action/agent)
│   ├── services/      # Business logic
│   │   ├── customer.service.ts  # PNR/name lookups, enriched profiles
│   │   ├── booking.service.ts   # leg lookups, disruption & status summaries
│   │   ├── policy.service.ts    # policy envelopes { policyId, source, details }
│   │   ├── audit.service.ts     # audit record persistence & queries
│   │   └── llm.service.ts       # Groq phraser (never decides policy)
│   ├── agents/        # Agent layer (deterministic core + orchestration)
│   │   ├── policy.engine.ts     # deterministic eligibility decisions
│   │   ├── intent.detector.ts   # rule-based intent + entity extraction
│   │   ├── action.executor.ts   # policy-gated simulated actions
│   │   ├── escalation.handler.ts# human escalation routing
│   │   └── agent.orchestrator.ts# full pipeline: intent→policy→action→audit
│   ├── controllers/   # Request handlers
│   ├── routes/        # Express routers
│   ├── middleware/    # Custom middleware (TODO)
│   ├── utils/         # Helpers (verify-data.ts)
│   ├── app.ts         # Express app setup
│   └── server.ts      # HTTP server bootstrap
├── scripts/
│   └── copy-data.js   # copies seed JSON to dist/ on build
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Data Layer

Seed data lives in `src/data/*.json` and is validated with zod at load time
(`src/data/schemas.ts`), with types in `src/types/`. Customers are keyed by
PNR; bookings link to customers via `pnr`. Bookings are a discriminated union
on `status` (`Cancelled | Delayed | Unaffected`).

Verify the data layer any time with:

```bash
npm run verify:data
```

## Policy Engine (`src/agents/policy.engine.ts`)

Deterministic eligibility decisions from the supplied rules — **the LLM never
decides policy**. Eight evaluators cover cancellation, delay compensation,
refund, fare difference, loyalty, action authorization, and escalation, each
returning `{ status, eligibleActions, ineligibleActions, requiresEscalation,
escalationReason, policySources, explanation }`.

Enforced boundaries: exactly 3h is *not* "more than 3" (voucher only); exactly
5h is *not* "more than 5" (no hotel); hotel is for delayed hours only; a waiver
of exactly ₹1,500 is allowed while anything above needs supervisor approval;
non-original refund methods are escalated; non-airline-caused disruptions get
no exceptions; flight rebooking details are never invented.

## Agent Support Modules

- **intent.detector** — rule-based classification into 12 intents
  (`flight_status`, `cancellation_support`, `refund_request`,
  `rebooking_request`, `delay_compensation`, `meal_voucher_request`,
  `lounge_request`, `hotel_request`, `fare_difference_request`,
  `upgrade_request`, `legal_complaint`, `unknown`) with entity extraction
  (PNR, flight number, payment method, ₹ amounts). Detection never overrides
  policy.
- **action.executor** — simulated execution of the five allowed actions,
  each gated by the policy engine; refusals are recorded as `failed` with the
  policy reason. Every record: unique id, PNR, action, status, timestamp,
  reason, `simulated: true`.
- **escalation.handler** — deterministic trigger → priority routing
  (legal/formal → high, money-related → medium, unclear → low) with status
  `escalated_to_human`.
- **audit.service** — `createAuditRecord` / `getAuditRecordsByPnr` /
  `getAllAuditRecords`, zod-validated, persisted to `src/data/audit-logs.json`.

## Agent Chat API

```
POST /api/agent/chat
{ "pnr": "TR1190B", "message": "My flight is delayed 4 hours and I need a hotel" }
```

Response: `{ success, data: { message, intent, customer, booking, policyUsed,
decision, actions, escalation, auditId, llmUsed } }`. Validation errors return
HTTP 400 with field-level issues.

Pipeline: validate → identify customer → detect intent → deterministic policy
engine → authorization → simulated execution → escalation → audit → response.

**LLM policy**: Groq (if `GROQ_API_KEY` is set) only *phrases* the final
deterministic response — it never decides eligibility, invents policy/flights,
or approves prohibited actions. Missing key, timeout, or API error
automatically falls back to deterministic replies; the three mandatory
scenarios work with or without a key. Set `LLM_DISABLED=1` to force fallback
mode. `GET /api/agent` reports LLM availability and model.

## Roadmap (not yet implemented)

- Agent service backed by the Groq SDK
- Middleware for error handling & request IDs
- Conversation/session management
