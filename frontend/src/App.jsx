import { useEffect, useState } from "react";

const AGENT_ID = "53f3919b-316f-4dbf-90ad-13be96cfae9e";

function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadFeed() {
    try {
      setLoading(true);

      const response = await fetch(
        `http://localhost:3000/api/agent/feed?agentId=${AGENT_ID}`
      );

      const data = await response.json();

      setPosts(data.posts || []);
    } catch (error) {
      console.error("Failed to load feed:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
  }, []);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.logo}>🤖 Nova AI Persona</h1>
          <p style={styles.subtitle}>
            Autonomous AI Technology Analyst
          </p>
        </div>

        <button style={styles.refresh} onClick={loadFeed}>
          ↻ Refresh
        </button>
      </header>

      <section style={styles.hero}>
        <div>
          <span style={styles.badge}>AUTONOMOUS AGENT</span>

          <h2 style={styles.heroTitle}>
            AI that discovers, evaluates and publishes.
          </h2>

          <p style={styles.heroText}>
            Nova continuously discovers AI technology news, evaluates
            its importance and creates an autonomous editorial feed.
          </p>
        </div>
      </section>

      <section style={styles.status}>
        <div>
          <strong>🟢 Agent Online</strong>
          <span>AI Tech Analyst</span>
        </div>

        <div>
          <strong>{posts.length}</strong>
          <span>Published Posts</span>
        </div>

        <div>
          <strong>10</strong>
          <span>Topics Discovered</span>
        </div>

        <div>
          <strong>90/100</strong>
          <span>Top Editorial Score</span>
        </div>
      </section>

      <main style={styles.main}>
        <div style={styles.sectionTitle}>
          <div>
            <h2>📰 Autonomous Feed</h2>
            <p>Content selected by the agent</p>
          </div>
        </div>

        {loading ? (
          <div style={styles.empty}>
            🤖 Loading autonomous feed...
          </div>
        ) : posts.length === 0 ? (
          <div style={styles.empty}>
            No autonomous posts yet.
          </div>
        ) : (
          <div style={styles.grid}>
            {posts.map((post) => {
              let sources = [];

              try {
                sources = JSON.parse(post.sources || "[]");
              } catch {
                sources = [];
              }

              return (
                <article key={post.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <span style={styles.aiTag}>AI TECHNOLOGY</span>
                    <span style={styles.date}>
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 style={styles.title}>
                    {post.text.split("\n")[0]}
                  </h3>

                  <p style={styles.content}>
                    {post.text.split("\n").slice(2).join(" ")}
                  </p>

                  <div style={styles.reason}>
                    <strong>🧠 Why the agent selected it</strong>
                    <p>{post.rationale}</p>
                  </div>

                  {sources.length > 0 && sources[0].url && (
                    <a
                      href={sources[0].url}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.link}
                    >
                      Read original source →
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <p>
          Autonomous AI Persona • Discovery → Reasoning → Publishing
        </p>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    color: "#172033",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },

  header: {
    background: "#111827",
    color: "white",
    padding: "22px 7%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  logo: {
    margin: 0,
    fontSize: "24px",
  },

  subtitle: {
    margin: "5px 0 0",
    opacity: 0.7,
  },

  refresh: {
    border: "none",
    padding: "11px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700,
  },

  hero: {
    padding: "70px 7%",
    background: "white",
  },

  badge: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: "20px",
    background: "#e8f5e9",
    color: "#16803c",
    fontSize: "12px",
    fontWeight: 800,
  },

  heroTitle: {
    fontSize: "46px",
    maxWidth: "800px",
    margin: "18px 0",
    lineHeight: 1.1,
  },

  heroText: {
    maxWidth: "700px",
    fontSize: "18px",
    lineHeight: 1.7,
    color: "#5b6475",
  },

  status: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "15px",
    padding: "25px 7%",
  },

  main: {
    padding: "35px 7%",
  },

  sectionTitle: {
    marginBottom: "25px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "24px",
  },

  card: {
    background: "white",
    borderRadius: "18px",
    padding: "25px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  aiTag: {
    fontSize: "11px",
    fontWeight: 800,
    padding: "6px 9px",
    borderRadius: "8px",
    background: "#eef2ff",
  },

  date: {
    fontSize: "12px",
    color: "#777",
  },

  title: {
    fontSize: "24px",
    lineHeight: 1.25,
  },

  content: {
    color: "#5b6475",
    lineHeight: 1.6,
  },

  reason: {
    marginTop: "20px",
    padding: "15px",
    borderRadius: "12px",
    background: "#f7f8fa",
    fontSize: "14px",
  },

  link: {
    display: "inline-block",
    marginTop: "18px",
    fontWeight: 700,
    color: "#2563eb",
    textDecoration: "none",
  },

  empty: {
    background: "white",
    padding: "50px",
    textAlign: "center",
    borderRadius: "18px",
  },

  footer: {
    textAlign: "center",
    padding: "30px",
    color: "#777",
  },
};

export default App;
