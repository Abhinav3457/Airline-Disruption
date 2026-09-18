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

| Script              | Description                      |
| ------------------- | -------------------------------- |
| `npm run dev`       | Dev server with watch mode (tsx) |
| `npm run build`     | Compile TypeScript to `dist/`    |
| `npm start`         | Run compiled server from `dist/` |
| `npm run typecheck` | Typecheck without emitting       |

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
│   ├── data/          # Mock/static data (bookings, flights, policies)
│   ├── types/         # Shared TypeScript types
│   ├── services/      # Business logic
│   ├── agents/        # LLM agent logic (Groq)
│   ├── controllers/   # Request handlers
│   ├── routes/        # Express routers
│   ├── middleware/    # Custom middleware
│   ├── utils/         # Helpers
│   ├── app.ts         # Express app setup
│   └── server.ts      # HTTP server bootstrap
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Roadmap (not yet implemented)

- Agent service backed by the Groq SDK
- Booking/flight data layer
- Middleware for error handling & request IDs
- Conversation/session management
