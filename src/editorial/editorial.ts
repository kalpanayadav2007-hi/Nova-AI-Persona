import { Topic } from "../discovery/discovery";
import { askGemini } from "../services/gemini";

export interface EditorialResult {
  topic: Topic;
  score: number;
  publish: boolean;
  reason: string;
}

let geminiTemporarilyUnavailable = false;

function localEvaluate(topic: Topic): EditorialResult {
  const text = `${topic.title} ${topic.summary}`.toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  if (
    text.includes("ai") ||
    text.includes("artificial intelligence") ||
    text.includes("llm") ||
    text.includes("model") ||
    text.includes("agent") ||
    text.includes("gemini") ||
    text.includes("gpt")
  ) {
    score += 35;
    reasons.push("Strong AI relevance");
  }

  if (
    text.includes("research") ||
    text.includes("api") ||
    text.includes("developer") ||
    text.includes("coding") ||
    text.includes("technical")
  ) {
    score += 25;
    reasons.push("Technical value");
  }

  if (
    text.includes("openai") ||
    text.includes("google") ||
    text.includes("anthropic") ||
    text.includes("deepmind")
  ) {
    score += 20;
    reasons.push("High industry impact");
  }

  if (topic.summary.length > 100) {
    score += 10;
    reasons.push("Rich information");
  }

  return {
    topic,
    score,
    publish: score >= 50,
    reason:
      reasons.length > 0
        ? reasons.join(", ")
        : "Limited relevance to the AI persona",
  };
}

export async function evaluateTopics(
  topics: Topic[]
): Promise<EditorialResult[]> {
  const results: EditorialResult[] = [];

  // Only process a maximum of 2 topics per cycle.
  const selectedTopics = topics.slice(0, 2);

  for (const topic of selectedTopics) {
    // If Gemini quota has already failed, use local intelligence.
    if (geminiTemporarilyUnavailable) {
      results.push(localEvaluate(topic));
      continue;
    }

    try {
      const prompt = `
You are the editorial brain of an autonomous AI technology persona.

Evaluate this article for publication.

Persona:
AI Tech Analyst focused on Artificial Intelligence.

Article:
Title: ${topic.title}

Summary:
${topic.summary}

Source:
${topic.source}

Evaluate:
- AI relevance
- technical depth
- industry importance
- educational value
- value to developers and AI builders

Return ONLY valid JSON:

{
  "score": 0,
  "publish": false,
  "reason": "short explanation"
}

Rules:
- score must be between 0 and 100
- publish=true when score >= 50
- publish=false when score < 50
`;

      const response = await askGemini(prompt);

      console.log(`🤖 Gemini evaluated: ${topic.title}`);

      const cleaned = response
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const evaluation = JSON.parse(cleaned);

      results.push({
        topic,
        score: Number(evaluation.score) || 0,
        publish: Boolean(evaluation.publish),
        reason: evaluation.reason || "Gemini evaluation completed",
      });
    } catch (error: any) {
      const message = String(error);

      if (
        message.includes("429") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("quota")
      ) {
        console.log(
          "⚠️ Gemini quota reached. Switching to local editorial intelligence."
        );

        geminiTemporarilyUnavailable = true;
      } else {
        console.log("⚠️ Gemini failed. Using local editorial intelligence.");
      }

      results.push(localEvaluate(topic));
    }
  }

  return results.sort((a, b) => b.score - a.score);
}