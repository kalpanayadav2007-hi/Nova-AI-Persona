import { Request, Response } from "express";
import { randomUUID } from "crypto";
import db from "../database/db";
import {
  startScheduler,
  runAutonomousCycle,
} from "../scheduler/scheduler";

/**
 * POST /api/agent/init
 *
 * Initialize the autonomous AI persona.
 */
export const initializeAgent = (req: Request, res: Response) => {
  try {
    const { persona } = req.body;

    if (!persona?.name || !persona?.domain) {
      return res.status(400).json({
        error: "persona.name and persona.domain are required",
      });
    }

    const agentId = randomUUID();

    const stmt = db.prepare(`
      INSERT INTO agents
      (id, name, domain, initializedAt)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      agentId,
      persona.name,
      persona.domain,
      new Date().toISOString()
    );

    // Start autonomous operation immediately.
    startScheduler(agentId);

    return res.status(200).json({
      message: "Autonomous AI Persona initialized successfully",
      agentId,
      persona: {
        name: persona.name,
        domain: persona.domain,
      },
    });
  } catch (error) {
    console.error("❌ Failed to initialize agent:", error);

    return res.status(500).json({
      error: "Failed to initialize autonomous agent",
    });
  }
};

/**
 * POST /api/agent/run
 *
 * Optional manual intelligence check for the dashboard.
 * The hackathon evaluator does NOT need this endpoint.
 */
export const runAgent = async (req: Request, res: Response) => {
  try {
    const { agentId } = req.body;

    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json({
        error: "agentId is required",
      });
    }

    const agent = db
      .prepare(`
        SELECT id, name, domain
        FROM agents
        WHERE id = ?
        LIMIT 1
      `)
      .get(agentId);

    if (!agent) {
      return res.status(404).json({
        error: "Agent not found",
      });
    }

    console.log("\n🚀 MANUAL INTELLIGENCE CHECK");
    console.log(`Agent: ${agentId}`);

    const result = await runAutonomousCycle(agentId);

    return res.status(200).json({
      message: "Autonomous intelligence cycle completed",
      agentId,
      result,
    });
  } catch (error) {
    console.error("❌ Manual agent run failed:", error);

    return res.status(500).json({
      error: "Failed to run autonomous intelligence cycle",
    });
  }
};

/**
 * GET /api/agent/feed?agentId=<AGENT_ID>
 *
 * This is the endpoint the hackathon evaluator will call.
 */
export const getFeed = (req: Request, res: Response) => {
  try {
    const { agentId } = req.query;

    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json({
        error: "agentId is required",
      });
    }

    const stmt = db.prepare(`
      SELECT
        id,
        createdAt,
        text,
        rationale,
        sources,
        whySelected,
        whyRelevantNow
      FROM posts
      WHERE agentId = ?
      ORDER BY datetime(createdAt) DESC
    `);

    const rows = stmt.all(agentId) as any[];

    const posts = rows.map((post) => {
      let parsedSources: any[] = [];

      try {
        parsedSources = JSON.parse(post.sources || "[]");
      } catch {
        parsedSources = [];
      }

      const sourceUrls = parsedSources
        .map((source) => {
          if (typeof source === "string") {
            return source;
          }

          return source?.url;
        })
        .filter(Boolean);

      return {
        id: post.id,
        createdAt: post.createdAt,
        text: post.text,
        rationale:
          post.rationale ||
          `Why selected: ${
            post.whySelected || "Editorial relevance"
          }. Why relevant now: ${
            post.whyRelevantNow || "Recent AI development."
          }`,
        sources: sourceUrls,
        whySelected: post.whySelected || "",
        whyRelevantNow: post.whyRelevantNow || "",
      };
    });

    return res.status(200).json({
      posts,
    });
  } catch (error) {
    console.error("❌ Failed to fetch feed:", error);

    return res.status(500).json({
      error: "Failed to fetch autonomous feed",
    });
  }
};