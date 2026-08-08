import { Router } from "express";
import { initializeAgent, getFeed } from "../controllers/agentController";

const router = Router();

router.post("/initialize", initializeAgent);

router.get("/feed", getFeed);

export default router;