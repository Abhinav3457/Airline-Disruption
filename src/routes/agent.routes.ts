import { Router } from 'express';

import {
  getAgentMeta,
  postAgentChat,
} from '../controllers/agent.controller';

import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// GET /api/agent — agent metadata (LLM availability, model, endpoints)
router.get('/', getAgentMeta);

// POST /api/agent/chat — main conversation entry point
router.post('/chat', asyncHandler(postAgentChat));

export default router;
