import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
});

export interface Topic {
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt: string;
}

interface FeedConfig {
  source: string;
  url: string;
}

const feeds: FeedConfig[] = [
  {
    source: "Google AI",
    url: "https://blog.google/technology/ai/rss/",
  },
  {
    source: "Google Research",
    url: "https://research.google/blog/rss/",
  },
  {
    source: "Hugging Face",
    url: "https://huggingface.co/blog/feed.xml",
  },
  {
    source: "MIT Technology Review",
    url: "https://www.technologyreview.com/feed/",
  },
];

function cleanText(text: string = ""): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecent(publishedAt: string): boolean {
  const date = new Date(publishedAt);

  if (Number.isNaN(date.getTime())) {
    return true;
  }

  // Keep topics from the last 7 days.
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return date.getTime() >= sevenDaysAgo;
}

export async function discoverTopics(): Promise<Topic[]> {
  const topics: Topic[] = [];

  console.log("\n🔎 DISCOVERY: Searching live AI sources...");

  for (const feed of feeds) {
    try {
      const rss = await parser.parseURL(feed.url);

      console.log(
        `✅ ${feed.source}: ${rss.items.length} articles found`
      );

      for (const item of rss.items) {
        const title = cleanText(item.title || "");
        const summary = cleanText(
          item.contentSnippet ||
            item.content ||
            item.summary ||
            ""
        );

        const link = item.link || "";

        const publishedAt =
          item.isoDate ||
          item.pubDate ||
          new Date().toISOString();

        if (!title || !link) {
          continue;
        }

        // Ignore old articles.
        if (!isRecent(publishedAt)) {
          continue;
        }

        topics.push({
          title,
          summary,
          link,
          source: feed.source,
          publishedAt,
        });
      }
    } catch (error) {
      console.error(
        `❌ Failed to fetch ${feed.source}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // Remove duplicate URLs.
  const uniqueByLink = new Map<string, Topic>();

  for (const topic of topics) {
    if (!uniqueByLink.has(topic.link)) {
      uniqueByLink.set(topic.link, topic);
    }
  }

  // Remove duplicate titles.
  const uniqueByTitle = new Map<string, Topic>();

  for (const topic of uniqueByLink.values()) {
    const normalizedTitle = topic.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (!uniqueByTitle.has(normalizedTitle)) {
      uniqueByTitle.set(normalizedTitle, topic);
    }
  }

  const result = Array.from(uniqueByTitle.values())
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    )
    .slice(0, 30);

  console.log(
    `📰 Fresh unique AI topics discovered: ${result.length}`
  );

  return result;
}
