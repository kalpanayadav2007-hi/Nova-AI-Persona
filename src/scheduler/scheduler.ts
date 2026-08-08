import cron from "node-cron";
import { discoverTopics } from "../discovery/discovery";
import { evaluateTopics } from "../editorial/editorial";
import db from "../database/db";
import { randomUUID } from "crypto";

let schedulerStarted = false;

async function runAutonomousCycle(agentId: string) {
  try {
    console.log("\n================================");
    console.log("🤖 AUTONOMOUS DISCOVERY");
    console.log("================================");

    console.log(`Agent: ${agentId}`);

    // 1. Discover topics
    const topics = await discoverTopics();

    console.log(`📰 Topics discovered: ${topics.length}`);

    if (topics.length === 0) {
      console.log("⚠️ No topics discovered.");
      return;
    }

    // 2. Editorial evaluation
    const results = await evaluateTopics(topics);

    console.log("\n========= EDITORIAL REVIEW =========");

    results.forEach((item) => {
      console.log(
        `[${item.publish ? "✅ PUBLISH" : "❌ REJECT"}] ${item.score} | ${item.topic.title}`
      );

      console.log(`Reason: ${item.reason}`);
    });

    // 3. Select best publishable topic
    const best = results.find((r) => r.publish);

    if (best) {
      console.log("\n🏆 SELECTED TOPIC");
      console.log(`Title : ${best.topic.title}`);
      console.log(`Score : ${best.score}`);
      console.log(`Reason: ${best.reason}`);

      // 4. Save autonomous post
      console.log("\n📝 AUTONOMOUS POST CREATED");

      try {
        const postId = randomUUID();

        db.prepare(`
          INSERT INTO posts
          (id, agentId, createdAt, text, rationale, sources)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          postId,
          agentId,
          new Date().toISOString(),
          `${best.topic.title}\n\n${best.topic.summary}`,
          best.reason,
          JSON.stringify([
            {
              source: best.topic.source,
              url: best.topic.link,
            },
          ])
        );

        console.log(`Post ID: ${postId}`);
        console.log("✅ Post saved to database");
      } catch (error) {
        console.error("❌ Failed to save post:", error);
      }
    } else {
      console.log("\n⚠️ No topic passed editorial review.");
    }

    console.log("\n================================\n");
  } catch (error) {
    console.error("❌ Scheduler Error:", error);
  }
}

export function startScheduler(agentId: string) {
  if (schedulerStarted) {
    console.log("⚠️ Scheduler already running");
    return;
  }

  schedulerStarted = true;

  console.log(`🤖 Scheduler started for Agent: ${agentId}`);

  // Run immediately when the agent starts.
  runAutonomousCycle(agentId);

  // Run every 10 minutes afterward.
  cron.schedule("*/10 * * * *", async () => {
    await runAutonomousCycle(agentId);
  });
}