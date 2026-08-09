import { Router } from "express";

import {
  initializeAgent,
  runAgent,
  getFeed,
} from "../controllers/agentController";

const router = Router();

/**
 * Initialize a new autonomous AI persona
 *
 * POST /api/agent/init
 */
router.post("/init", initializeAgent);

/**
 * Manually run one autonomous intelligence cycle
 *
 * POST /api/agent/run
 */
router.post("/run", runAgent);

/**
 * Get the autonomous editorial feed
 *
 * GET /api/agent/feed?agentId=YOUR_AGENT_ID
 */
router.get("/feed", getFeed);

export default router;