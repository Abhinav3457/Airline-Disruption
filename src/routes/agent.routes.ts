import { Router } from 'express';

import {
  getAgentMeta,
  postAgentChat,
} from '../controllers/agent.controller';

const router = Router();

// POST /api/agent/chat — main conversation entry point
router.post('/chat', postAgentChat);

// GET /api/agent — agent metadata
router.get('/', getAgentMeta);

export default router;
