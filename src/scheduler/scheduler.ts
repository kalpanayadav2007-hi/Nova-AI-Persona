import cron from "node-cron";
import { randomUUID } from "crypto";

import { discoverTopics } from "../discovery/discovery";
import { evaluateTopics } from "../editorial/editorial";
import db from "../database/db";

let schedulerStarted = false;

export async function runAutonomousCycle(agentId: string) {
  try {
    console.log("\n================================");
    console.log("🤖 AUTONOMOUS DISCOVERY");
    console.log("================================");

    console.log(`Agent: ${agentId}`);

    // --------------------------------------------------
    // 0. LOAD PERSONA
    // --------------------------------------------------

    const agent = db
      .prepare(`
        SELECT id, name, domain
        FROM agents
        WHERE id = ?
        LIMIT 1
      `)
      .get(agentId) as
      | {
          id: string;
          name: string;
          domain: string;
        }
      | undefined;

    if (!agent) {
      console.error("❌ Agent not found:", agentId);

      return {
        published: false,
        duplicate: false,
        reason: "Agent not found",
      };
    }

    console.log(`Persona: ${agent.name}`);
    console.log(`Domain: ${agent.domain}`);

    // --------------------------------------------------
    // 1. DISCOVER
    // --------------------------------------------------

    const topics = await discoverTopics();

    console.log(`📰 Topics discovered: ${topics.length}`);

    if (topics.length === 0) {
      console.log("⚠️ No topics discovered.");

      return {
        published: false,
        duplicate: false,
        reason: "No topics discovered",
      };
    }

    // --------------------------------------------------
    // 2. EVALUATE
    // --------------------------------------------------

    const results = await evaluateTopics(topics);

    console.log("\n========= EDITORIAL REVIEW =========");

    results.forEach((item) => {
      console.log(
        `[${item.publish ? "✅ PUBLISH" : "❌ REJECT"}] ${item.score} | ${item.topic.title}`
      );

      console.log(`Reason: ${item.reason}`);
    });

    // --------------------------------------------------
    // 3. SORT PUBLISHABLE TOPICS
    // --------------------------------------------------

    const candidates = results
      .filter((item) => item.publish)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      console.log("\n⚠️ No topic passed editorial review.");
      console.log("\n================================\n");

      return {
        published: false,
        duplicate: false,
        reason: "No topic passed editorial review",
      };
    }

    // --------------------------------------------------
    // 4. MEMORY CHECK
    // --------------------------------------------------

    let selected: (typeof candidates)[number] | null = null;

    for (const candidate of candidates) {
      console.log(
        `\n🔎 Checking memory for: ${candidate.topic.title}`
      );

      const existingPost = db
        .prepare(`
          SELECT id
          FROM posts
          WHERE agentId = ?
          AND (
            text LIKE ?
            OR sources LIKE ?
          )
          LIMIT 1
        `)
        .get(
          agentId,
          `%${candidate.topic.title}%`,
          `%${candidate.topic.link}%`
        );

      if (existingPost) {
        console.log("🧠 Memory: already exists");
        console.log(`⏭️ Skipping: ${candidate.topic.title}`);
        continue;
      }

      selected = candidate;
      break;
    }

    // --------------------------------------------------
    // 5. NOTHING NEW
    // --------------------------------------------------

    if (!selected) {
      console.log("\n🧠 MEMORY RESULT");
      console.log("⚠️ All publishable topics already exist.");
      console.log("⏭️ Nothing new to publish.");

      console.log("\n================================\n");

      return {
        published: false,
        duplicate: true,
        reason:
          "All publishable topics already exist in Nova's memory",
        topic: candidates[0]?.topic.title || "",
      };
    }

    // --------------------------------------------------
    // 6. SELECT NEW TOPIC
    // --------------------------------------------------

    console.log("\n🏆 SELECTED NEW TOPIC");
    console.log(`Title : ${selected.topic.title}`);
    console.log(`Score : ${selected.score}`);
    console.log(`Reason: ${selected.reason}`);

    // --------------------------------------------------
    // 7. AUTONOMOUS REASONING
    // --------------------------------------------------

    const whySelected =
      selected.reason ||
      `Selected because it strongly matches ${agent.name}'s ${agent.domain} editorial criteria.`;

    const whyRelevantNow =
      `This topic is relevant now because it is a recent development ` +
      `with potential importance to ${agent.domain}. ` +
      `It provides useful information for an audience interested in ${agent.domain}.`;

    const rationale =
      `Why selected: ${whySelected} ` +
      `Why relevant now: ${whyRelevantNow}`;

    // --------------------------------------------------
    // 8. CREATE POST
    // --------------------------------------------------

    console.log("\n📝 AUTONOMOUS POST CREATED");

    const postId = randomUUID();

    const sources = JSON.stringify([
      {
        source: selected.topic.source,
        url: selected.topic.link,
      },
    ]);

    // --------------------------------------------------
    // 9. SAVE TO MEMORY
    // --------------------------------------------------

    db.prepare(`
      INSERT INTO posts
      (
        id,
        agentId,
        createdAt,
        text,
        rationale,
        sources,
        whySelected,
        whyRelevantNow
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      postId,
      agentId,
      new Date().toISOString(),
      selected.topic.title +
        "\n\n" +
        selected.topic.summary,
      rationale,
      sources,
      whySelected,
      whyRelevantNow
    );

    console.log(`Post ID: ${postId}`);
    console.log("✅ Post saved to database");
    console.log("🧠 Memory updated");
    console.log("⚡ Why relevant now:", whyRelevantNow);

    console.log("\n================================\n");

    return {
      published: true,
      duplicate: false,
      topic: selected.topic.title,
      score: selected.score,
      reason: selected.reason,
      postId,
    };
  } catch (error) {
    console.error("❌ Scheduler Error:", error);

    throw error;
  }
}

// --------------------------------------------------
// AUTONOMOUS SCHEDULER
// --------------------------------------------------

export function startScheduler(agentId: string) {
  if (schedulerStarted) {
    console.log("⚠️ Scheduler already running");
    return;
  }

  schedulerStarted = true;

  console.log(
    `🤖 Scheduler started for Agent: ${agentId}`
  );

  // Run immediately after initialization.
  runAutonomousCycle(agentId).catch((error) => {
    console.error(
      "❌ Initial autonomous cycle failed:",
      error
    );
  });

  // Continue autonomously every 10 minutes.
  cron.schedule("*/10 * * * *", async () => {
    console.log(
      "\n⏰ Scheduled autonomous cycle triggered"
    );

    try {
      await runAutonomousCycle(agentId);
    } catch (error) {
      console.error(
        "❌ Scheduled autonomous cycle failed:",
        error
      );
    }
  });
}