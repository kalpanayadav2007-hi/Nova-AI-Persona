import Parser from "rss-parser";

const parser = new Parser();

export interface Topic {
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt: string;
}

export async function discoverTopics(): Promise<Topic[]> {
  const feeds = [
    {
      source: "Google AI",
      url: "https://blog.google/technology/ai/rss/",
    },
  ];

  const topics: Topic[] = [];

  for (const feed of feeds) {
    try {
      const rss = await parser.parseURL(feed.url);

      for (const item of rss.items.slice(0, 10)) {
        topics.push({
          title: item.title || "",
          summary: item.contentSnippet || item.content || "",
          link: item.link || "",
          source: feed.source,
          publishedAt: item.pubDate || new Date().toISOString(),
        });
      }

      console.log(`✅ Fetched ${feed.source}`);
    } catch (err) {
      console.log(`❌ Failed to fetch ${feed.source}`);
    }
  }

  return topics;
}