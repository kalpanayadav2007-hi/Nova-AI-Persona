import { Topic } from "../discovery/discovery";
import { askGemini } from "../services/gemini";

export interface EditorialResult {
  topic: Topic;
  score: number;
  publish: boolean;
  reason: string;
}

let geminiTemporarilyUnavailable = false;

/**
 * Local editorial intelligence.
 *
 * This is the fallback used when Gemini is unavailable.
 * Nova's editorial identity:
 * - AI technology focused
 * - technically useful
 * - relevant to developers/builders
 * - meaningful industry impact
 */
function localEvaluate(topic: Topic): EditorialResult {
  const text = `${topic.title} ${topic.summary}`.toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  // --------------------------------------------------
  // 1. AI RELEVANCE
  // --------------------------------------------------

  const aiKeywords = [
    "ai",
    "artificial intelligence",
    "machine learning",
    "deep learning",
    "llm",
    "large language model",
    "generative ai",
    "generative artificial intelligence",
    "ai model",
    "foundation model",
    "neural network",
    "agent",
    "ai agent",
    "multimodal",
    "robotics",
  ];

  if (aiKeywords.some((keyword) => text.includes(keyword))) {
    score += 35;
    reasons.push("Strong AI relevance");
  }

  // --------------------------------------------------
  // 2. TECHNICAL / BUILDER VALUE
  // --------------------------------------------------

  const technicalKeywords = [
    "api",
    "developer",
    "developers",
    "coding",
    "programming",
    "software",
    "github",
    "open source",
    "opensource",
    "framework",
    "sdk",
    "model",
    "research",
    "benchmark",
    "inference",
    "training",
    "deployment",
    "cloud",
    "data",
    "dataset",
    "algorithm",
    "architecture",
    "engineering",
  ];

  const technicalMatches = technicalKeywords.filter((keyword) =>
    text.includes(keyword)
  ).length;

  if (technicalMatches >= 2) {
    score += 30;
    reasons.push("Strong technical and builder value");
  } else if (technicalMatches === 1) {
    score += 20;
    reasons.push("Technical value");
  }

  // --------------------------------------------------
  // 3. INDUSTRY IMPACT
  // --------------------------------------------------

  const industryKeywords = [
    "openai",
    "google",
    "anthropic",
    "deepmind",
    "microsoft",
    "meta",
    "nvidia",
    "hugging face",
    "apple",
    "amazon",
    "gemini",
    "gpt",
    "claude",
    "llama",
    "copilot",
  ];

  if (industryKeywords.some((keyword) => text.includes(keyword))) {
    score += 15;
    reasons.push("High industry relevance");
  }

  // --------------------------------------------------
  // 4. FRESHNESS / CURRENT DEVELOPMENT
  // --------------------------------------------------

  const currentKeywords = [
    "new",
    "latest",
    "launch",
    "launched",
    "release",
    "released",
    "announced",
    "introduces",
    "introduced",
    "update",
    "updated",
    "today",
    "this week",
    "recent",
    "research",
    "breakthrough",
  ];

  if (currentKeywords.some((keyword) => text.includes(keyword))) {
    score += 10;
    reasons.push("Recent development");
  }

  // --------------------------------------------------
  // 5. INFORMATION QUALITY
  // --------------------------------------------------

  if (topic.summary.length >= 300) {
    score += 10;
    reasons.push("Rich information");
  } else if (topic.summary.length >= 150) {
    score += 5;
    reasons.push("Useful context");
  }

  // --------------------------------------------------
  // 6. AVOID LOW-VALUE CONTENT
  // --------------------------------------------------

  const lowValueKeywords = [
    "censorship conspiracy",
    "celebrity",
    "horoscope",
    "giveaway",
    "advertisement",
    "sponsored",
    "coupon",
    "sale",
    "fashion",
    "sports",
    "movie review",
  ];

  if (lowValueKeywords.some((keyword) => text.includes(keyword))) {
    score -= 30;
    reasons.push("Low fit for Nova's AI technology persona");
  }

  // Keep score within 0–100.
  score = Math.max(0, Math.min(100, score));

  // Nova publishes meaningful AI/technology developments.
  const publish = score >= 50;

  return {
    topic,
    score,
    publish,
    reason:
      reasons.length > 0
        ? reasons.join(", ")
        : "Limited relevance to Nova's AI technology editorial criteria",
  };
}

export async function evaluateTopics(
  topics: Topic[]
): Promise<EditorialResult[]> {
  const results: EditorialResult[] = [];

  /*
   * Evaluate more candidates.
   *
   * Previously this was only:
   *
   * topics.slice(0, 2)
   *
   * That could cause Nova to reject two weak stories
   * while ignoring stronger stories discovered later.
   */
  const selectedTopics = topics.slice(0, 10);

  for (const topic of selectedTopics) {
    // --------------------------------------------------
    // GEMINI FALLBACK
    // --------------------------------------------------

    if (geminiTemporarilyUnavailable) {
      results.push(localEvaluate(topic));
      continue;
    }

    try {
      const prompt = `
You are the editorial brain of an autonomous AI technology persona named Nova.

Nova is an independent AI Tech Analyst.

Nova focuses on:
- artificial intelligence
- machine learning
- AI agents
- developer tools
- AI research
- AI infrastructure
- robotics
- open source AI
- important technology developments

Nova should NOT publish every article.

Evaluate this article for publication.

ARTICLE

Title:
${topic.title}

Summary:
${topic.summary}

Source:
${topic.source}

Evaluate:

1. AI relevance
2. Technical depth
3. Industry importance
4. Educational value
5. Value to developers and AI builders
6. Whether this is genuinely worth adding to Nova's editorial feed

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
- Do not publish generic or low-value content
- Prefer technically meaningful AI developments
- Prefer fresh developments
- Prefer stories useful to AI builders and developers
`;

      const response = await askGemini(prompt);

      console.log(`🤖 Gemini evaluated: ${topic.title}`);

      const cleaned = response
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const evaluation = JSON.parse(cleaned);

      const score = Math.max(
        0,
        Math.min(100, Number(evaluation.score) || 0)
      );

      results.push({
        topic,
        score,
        publish: score >= 50,
        reason:
          evaluation.reason ||
          "Gemini editorial evaluation completed",
      });
    } catch (error: unknown) {
      const message = String(error);

      if (
        message.includes("429") ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.toLowerCase().includes("quota")
      ) {
        console.log(
          "⚠️ Gemini quota reached. Switching to local editorial intelligence."
        );

        geminiTemporarilyUnavailable = true;
      } else {
        console.log(
          "⚠️ Gemini failed. Using local editorial intelligence."
        );
      }

      results.push(localEvaluate(topic));
    }
  }

  // Highest scoring stories first.
  return results.sort((a, b) => b.score - a.score);
}