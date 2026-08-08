import { Router } from "express";
import {
  initializeAgent,
  getFeed
} from "./controllers";

const router = Router();

router.post("/initialize", initializeAgent);
router.get("/agent/feed", getFeed);

export default router;