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
│   │   ├── action-logs.json  # runtime audit trail (starts empty)
│   │   ├── schemas.ts        # zod schemas pinned to domain types
│   │   └── store.ts          # typed loaders + PNR lookups
│   ├── types/         # Shared TypeScript types (customer/booking/policy/action/agent)
│   ├── services/      # Business logic
│   │   ├── customer.service.ts  # PNR/name lookups, enriched profiles
│   │   ├── booking.service.ts   # leg lookups, disruption & status summaries
│   │   └── policy.service.ts    # policy envelopes { policyId, source, details }
│   ├── agents/        # LLM agent logic (Groq) (TODO)
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

## Roadmap (not yet implemented)

- Agent service backed by the Groq SDK
- Middleware for error handling & request IDs
- Conversation/session management
