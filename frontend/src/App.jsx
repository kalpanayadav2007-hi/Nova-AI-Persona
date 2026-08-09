import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:3000";

const AGENT_STORAGE_KEY = "novaAgentId";
const PERSONA_STORAGE_KEY = "novaPersona";

// ==================================================
// MAIN APP
// ==================================================

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  const [agentId, setAgentId] = useState(
    () => localStorage.getItem(AGENT_STORAGE_KEY) || ""
  );

  const [persona, setPersona] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(PERSONA_STORAGE_KEY) || "null"
      );
    } catch {
      return null;
    }
  });

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [intelligenceResult, setIntelligenceResult] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ==================================================
  // CREATE PERSONA
  // ==================================================

  async function createPersona(name, domain) {
    try {
      setCreating(true);
      setError("");
      setNotice("");

      const response = await fetch(`${API_URL}/api/agent/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          persona: {
            name,
            domain,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `API returned ${response.status}`
        );
      }

      const newAgentId = data.agentId;

      if (!newAgentId) {
        throw new Error("Backend did not return an agent ID.");
      }

      const newPersona = data.persona || {
        name,
        domain,
      };

      localStorage.setItem(
        AGENT_STORAGE_KEY,
        newAgentId
      );

      localStorage.setItem(
        PERSONA_STORAGE_KEY,
        JSON.stringify(newPersona)
      );

      setAgentId(newAgentId);
      setPersona(newPersona);

      setNotice(
        "Nova persona created successfully. Your autonomous agent is ready."
      );
    } catch (err) {
      console.error("Persona creation failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create Nova persona."
      );
    } finally {
      setCreating(false);
    }
  }

  // ==================================================
  // LOAD FEED
  // ==================================================

  async function loadFeed() {
    if (!agentId) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/agent/feed?agentId=${encodeURIComponent(
          agentId
        )}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `API returned ${response.status}`
        );
      }

      setPosts(
        Array.isArray(data.posts) ? data.posts : []
      );

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load feed:", err);

      setError(
        "Nova cannot connect to the backend. Make sure the backend is running on port 3000."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==================================================
  // RUN AUTONOMOUS INTELLIGENCE
  // ==================================================

  async function runIntelligenceCheck() {
    if (!agentId) {
      setError("Create your Nova persona first.");
      setActivePage("dashboard");
      return;
    }

    try {
      setChecking(true);
      setError("");
      setNotice("");
      setIntelligenceResult(null);

      const response = await fetch(
        `${API_URL}/api/agent/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `API returned ${response.status}`
        );
      }

      setIntelligenceResult(data);

      await loadFeed();

      setNotice(
        "Nova completed an autonomous intelligence cycle."
      );
    } catch (err) {
      console.error(
        "Intelligence check failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Nova could not complete the intelligence cycle."
      );
    } finally {
      setChecking(false);
    }
  }

  // ==================================================
  // REFRESH
  // ==================================================

  async function handleRefresh() {
    await loadFeed();
  }

  // ==================================================
  // RESET PERSONA
  // ==================================================

  function resetPersona() {
    const confirmed = window.confirm(
      "Remove this Nova persona from this browser?"
    );

    if (!confirmed) return;

    localStorage.removeItem(AGENT_STORAGE_KEY);
    localStorage.removeItem(PERSONA_STORAGE_KEY);

    setAgentId("");
    setPersona(null);
    setPosts([]);
    setIntelligenceResult(null);
    setNotice("");
    setError("");
    setActivePage("dashboard");
  }

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    if (!agentId) return;

    loadFeed();

    const interval = setInterval(() => {
      loadFeed();
    }, 30000);

    return () => clearInterval(interval);
  }, [agentId]);

  // ==================================================
  // HELPERS
  // ==================================================

  const latestPost = posts[0];

  const topScore = useMemo(() => {
    if (!posts.length) return 0;

    return Math.max(
      ...posts.map((post) => {
        if (typeof post.score === "number") {
          return post.score;
        }

        const match = String(
          post.rationale || ""
        ).match(/\b(\d{1,3})\b/);

        return match ? Number(match[1]) : 0;
      })
    );
  }, [posts]);

  function getTitle(text = "") {
    return (
      text.split("\n")[0] ||
      "Untitled AI story"
    );
  }

  function getSummary(text = "") {
    const parts = text.split("\n");

    return (
      parts.slice(2).join(" ").trim() ||
      parts.slice(1).join(" ").trim() ||
      "No summary available."
    );
  }

  function getSources(sourceText) {
    if (Array.isArray(sourceText)) {
      return sourceText;
    }

    try {
      return JSON.parse(sourceText || "[]");
    } catch {
      return [];
    }
  }

  // ==================================================
  // FIRST TIME USER
  // ==================================================

  if (!agentId || !persona) {
    return (
      <div className="app">
        <header className="navbar">
          <div className="brand">
            <div className="brandIcon">N</div>

            <div>
              <h1>Nova</h1>
              <span>Autonomous AI Persona</span>
            </div>
          </div>

          <div className="navRight">
            <div className="online">
              <span className="pulse"></span>
              Agent Offline
            </div>
          </div>
        </header>

        <main className="setupPage">
          <PersonaSetup
            onCreate={createPersona}
            creating={creating}
            error={error}
          />
        </main>
      </div>
    );
  }

  // ==================================================
  // APPLICATION
  // ==================================================

  return (
    <div className="app">

      {/* ================= NAVBAR ================= */}

      <header className="navbar">

        <div className="brand">
          <div className="brandIcon">N</div>

          <div>
            <h1>Nova</h1>
            <span>Autonomous AI Persona</span>
          </div>
        </div>

        <nav className="navLinks">

          <button
            className={
              activePage === "dashboard"
                ? "navButton active"
                : "navButton"
            }
            onClick={() =>
              setActivePage("dashboard")
            }
          >
            Dashboard
          </button>

          <button
            className={
              activePage === "activity"
                ? "navButton active"
                : "navButton"
            }
            onClick={() =>
              setActivePage("activity")
            }
          >
            Activity
          </button>

          <button
            className={
              activePage === "memory"
                ? "navButton active"
                : "navButton"
            }
            onClick={() =>
              setActivePage("memory")
            }
          >
            Memory
          </button>

        </nav>

        <div className="navRight">

          <div className="online">
            <span className="pulse"></span>
            Agent Online
          </div>

          <button
            className="refreshButton"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>

        </div>

      </header>

      {/* ================= NOTICES ================= */}

      {notice && (
        <div className="noticeBar">
          ✓ {notice}
        </div>
      )}

      {error && (
        <div className="errorBar">
          <strong>Connection problem:</strong>{" "}
          {error}
        </div>
      )}

      {/* ==================================================
          DASHBOARD
      ================================================== */}

      {activePage === "dashboard" && (
        <main>

          {/* HERO */}

          <section className="heroSection">

            <div className="heroContent">

              <div className="eyebrow">
                <span className="eyebrowDot"></span>
                AUTONOMOUS INTELLIGENCE SYSTEM
              </div>

              <h2>
                {persona.name || "Nova"} doesn't wait
                <br />
                <span>for instructions.</span>
              </h2>

              <p>
                Nova continuously discovers AI
                developments, evaluates their importance,
                selects what matters, and publishes its
                own editorial feed.
              </p>

              <div className="personaInfo">

                <span>PERSONA</span>
                <strong>
                  {persona.name}
                </strong>

                <span>DOMAIN</span>
                <strong>
                  {persona.domain}
                </strong>

              </div>

              <div className="heroActions">

                <button
                  className="primaryButton"
                  onClick={runIntelligenceCheck}
                  disabled={checking}
                >
                  {checking
                    ? "Nova is thinking..."
                    : "Run Intelligence Check →"}
                </button>

                <span className="cycleText">
                  ⟳ Autonomous cycle active
                </span>

              </div>

              {intelligenceResult?.result && (
                <div className="intelligenceResult">

                  <strong>
                    {intelligenceResult.result
                      .published
                      ? "✓ Nova published a new decision"
                      : intelligenceResult.result
                          .duplicate
                      ? "↻ Nova found existing content"
                      : "✓ Nova completed the cycle"}
                  </strong>

                  {intelligenceResult.result
                    .topic && (
                    <span>
                      Topic:{" "}
                      {
                        intelligenceResult.result
                          .topic
                      }
                    </span>
                  )}

                  {intelligenceResult.result
                    .reason && (
                    <span>
                      {
                        intelligenceResult.result
                          .reason
                      }
                    </span>
                  )}

                </div>
              )}

            </div>

            <div className="agentOrb">

              <div className="orbRing ringOne"></div>
              <div className="orbRing ringTwo"></div>

              <div className="orbCore">
                <span>N</span>
              </div>

              <div className="orbLabel">
                NOVA
              </div>

            </div>

          </section>

          {/* PIPELINE */}

          <section className="pipelineSection">

            <div className="sectionLabel">
              AUTONOMOUS PIPELINE
            </div>

            <div className="pipeline">

              <PipelineStep
                number="01"
                icon="⌕"
                title="Discover"
                text="Finds fresh AI developments"
              />

              <div className="pipelineArrow">
                →
              </div>

              <PipelineStep
                number="02"
                icon="◉"
                title="Evaluate"
                text="Scores relevance and impact"
              />

              <div className="pipelineArrow">
                →
              </div>

              <PipelineStep
                number="03"
                icon="✓"
                title="Decide"
                text="Selects what deserves attention"
              />

              <div className="pipelineArrow">
                →
              </div>

              <PipelineStep
                number="04"
                icon="↗"
                title="Publish"
                text="Creates an autonomous post"
              />

              <div className="pipelineArrow">
                →
              </div>

              <PipelineStep
                number="05"
                icon="◌"
                title="Remember"
                text="Stores decisions in memory"
              />

            </div>

          </section>

          {/* STATUS */}

          <section className="liveStatus">

            <div className="sectionLabel">
              LIVE AGENT STATUS
            </div>

            <div className="statusGrid">

              <StatusCard
                label="AGENT"
                value="ONLINE"
                detail="Autonomous"
                active
              />

              <StatusCard
                label="PUBLISHED"
                value={posts.length}
                detail="Posts in memory"
              />

              <StatusCard
                label="DISCOVERY"
                value="15"
                detail="Topics / cycle"
              />

              <StatusCard
                label="BEST SCORE"
                value={topScore || "—"}
                detail="Editorial decision"
              />

              <StatusCard
                label="MEMORY"
                value="ACTIVE"
                detail="SQLite persistence"
                active
              />

            </div>

          </section>

          {/* LATEST DECISION */}

          {latestPost && (
            <section className="contentSection">

              <div className="sectionHeader">

                <div>

                  <div className="sectionLabel">
                    LATEST DECISION
                  </div>

                  <h2>
                    What Nova decided matters
                  </h2>

                </div>

                <span className="decisionBadge">
                  ✓ PUBLISHED
                </span>

              </div>

              <PostCard
                post={latestPost}
                featured
              />

            </section>
          )}

          {/* FEED */}

          <section className="contentSection">

            <div className="sectionHeader">

              <div>

                <div className="sectionLabel">
                  AGENT MEMORY
                </div>

                <h2>
                  Autonomous Editorial Feed
                </h2>

                <p>
                  Every published decision becomes
                  part of Nova's memory.
                </p>

              </div>

              {lastUpdated && (
                <span className="updated">
                  Updated{" "}
                  {lastUpdated.toLocaleTimeString()}
                </span>
              )}

            </div>

            {loading ? (
              <div className="stateCard">

                <div className="loader"></div>

                <h3>
                  Nova is checking its memory...
                </h3>

              </div>
            ) : posts.length === 0 ? (
              <div className="stateCard">

                <div className="emptyIcon">
                  ⌕
                </div>

                <h3>
                  No autonomous posts yet
                </h3>

                <p>
                  Click "Run Intelligence Check"
                  and let Nova discover its first
                  story.
                </p>

              </div>
            ) : (
              <div className="postGrid">

                {posts
                  .slice(0, 6)
                  .map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                    />
                  ))}

              </div>
            )}

          </section>

        </main>
      )}

      {/* ==================================================
          ACTIVITY
      ================================================== */}

      {activePage === "activity" && (
        <ActivityPage
          posts={posts}
          latestPost={latestPost}
          checking={checking}
          onRun={runIntelligenceCheck}
        />
      )}

      {/* ==================================================
          MEMORY
      ================================================== */}

      {activePage === "memory" && (
        <MemoryPage
          posts={posts}
          getTitle={getTitle}
          getSummary={getSummary}
          getSources={getSources}
        />
      )}

      {/* ================= FOOTER ================= */}

      <footer className="footer">

        <div>
          <strong>NOVA</strong>
          <span>
            Autonomous AI Persona
          </span>
        </div>

        <div className="footerPersona">
          {persona.name} · {persona.domain}
        </div>

        <button
          className="resetButton"
          onClick={resetPersona}
        >
          Reset Persona
        </button>

      </footer>

    </div>
  );
}

// ==================================================
// PERSONA SETUP
// ==================================================

function PersonaSetup({
  onCreate,
  creating,
  error,
}) {
  const [name, setName] = useState("Nova");
  const [domain, setDomain] =
    useState("AI Systems");

  function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim() || !domain.trim()) {
      return;
    }

    onCreate(
      name.trim(),
      domain.trim()
    );
  }

  return (
    <div className="setupContainer">

      <div className="setupLogo">
        N
      </div>

      <div className="setupCard">

        <div className="eyebrow">
          <span className="eyebrowDot"></span>
          AUTONOMOUS AI PERSONA
        </div>

        <h1>
          Create your AI agent
        </h1>

        <p>
          Give Nova a personality and a domain.
          Your agent will discover information,
          evaluate it, make decisions, publish
          content, and remember what it learned.
        </p>

        <form onSubmit={handleSubmit}>

          <label>
            Persona name

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Nova"
            />
          </label>

          <label>
            Domain

            <input
              value={domain}
              onChange={(e) =>
                setDomain(e.target.value)
              }
              placeholder="AI Systems"
            />
          </label>

          {error && (
            <div className="setupError">
              {error}
            </div>
          )}

          <button
            className="primaryButton setupButton"
            type="submit"
            disabled={creating}
          >
            {creating
              ? "Creating autonomous agent..."
              : "Create Nova →"}
          </button>

        </form>

        <div className="setupPipeline">

          <span>Discover</span>
          <b>→</b>

          <span>Evaluate</span>
          <b>→</b>

          <span>Decide</span>
          <b>→</b>

          <span>Publish</span>
          <b>→</b>

          <span>Remember</span>

        </div>

      </div>

    </div>
  );
}

// ==================================================
// POST CARD
// ==================================================

function PostCard({
  post,
  featured = false,
}) {
  function getTitle(text = "") {
    return (
      text.split("\n")[0] ||
      "Untitled AI story"
    );
  }

  function getSummary(text = "") {
    const parts = text.split("\n");

    return (
      parts.slice(2).join(" ").trim() ||
      parts.slice(1).join(" ").trim() ||
      "No summary available."
    );
  }

  function getSources(sourceText) {
    if (Array.isArray(sourceText)) {
      return sourceText;
    }

    try {
      return JSON.parse(
        sourceText || "[]"
      );
    } catch {
      return [];
    }
  }

  const sources = getSources(
    post.sources
  );

  return (
    <article
      className={
        featured
          ? "postCard featuredPost"
          : "postCard"
      }
    >

      <div className="postTop">

        <span className="sourceTag">
          AI TECHNOLOGY
        </span>

        <span className="postDate">
          {post.createdAt
            ? new Date(
                post.createdAt
              ).toLocaleDateString()
            : ""}
        </span>

      </div>

      <h3>
        {getTitle(post.text)}
      </h3>

      <p>
        {getSummary(post.text)}
      </p>

      <div className="miniReason">

        <span>WHY SELECTED</span>

        <strong>
          {post.whySelected ||
            post.rationale ||
            "Editorial relevance"}
        </strong>

      </div>

      {post.whyRelevantNow && (
        <div className="miniReason">

          <span>WHY NOW</span>

          <strong>
            {post.whyRelevantNow}
          </strong>

        </div>
      )}

      <div className="postBottom">

        <span className="scoreBadge">
          {post.score || "—"} / 100
        </span>

        {sources.length > 0 &&
          sources[0]?.url && (
            <a
              className="readLink"
              href={sources[0].url}
              target="_blank"
              rel="noreferrer"
            >
              Original source →
            </a>
          )}

      </div>

    </article>
  );
}

// ==================================================
// ACTIVITY PAGE
// ==================================================

function ActivityPage({
  posts,
  latestPost,
  checking,
  onRun,
}) {
  return (
    <main className="pageContainer">

      <section className="pageHero">

        <div className="sectionLabel">
          AUTONOMOUS ACTIVITY
        </div>

        <h1>
          Watch Nova think.
        </h1>

        <p>
          Nova follows an autonomous pipeline
          instead of waiting for a user to tell
          it what to do.
        </p>

        <button
          className="primaryButton"
          onClick={onRun}
          disabled={checking}
        >
          {checking
            ? "Nova is working..."
            : "Run Intelligence Check →"}
        </button>

      </section>

      <div className="activityTimeline largeTimeline">

        <ActivityItem
          status="complete"
          title="Discovery"
          text="Nova searches live AI and technology sources for fresh developments."
        />

        <ActivityItem
          status="complete"
          title="Editorial evaluation"
          text="Each discovered topic is evaluated for AI relevance, technical value and industry impact."
        />

        <ActivityItem
          status="complete"
          title="Decision"
          text={
            latestPost
              ? `Nova selected "${latestPost.text?.split("\n")[0]}".`
              : "No decision has been published yet."
          }
        />

        <ActivityItem
          status="complete"
          title="Publishing"
          text={
            posts.length
              ? `${posts.length} published decision(s) are currently stored in memory.`
              : "Nova has not published a decision yet."
          }
        />

        <ActivityItem
          status="complete"
          title="Memory"
          text="Published decisions are persisted in SQLite so Nova can avoid repeating the same content."
        />

        <ActivityItem
          status="active"
          title="Autonomous cycle"
          text="Nova is ready to run another intelligence cycle."
        />

      </div>

    </main>
  );
}

// ==================================================
// MEMORY PAGE
// ==================================================

function MemoryPage({
  posts,
  getTitle,
  getSummary,
  getSources,
}) {
  const [search, setSearch] =
    useState("");

  const filteredPosts =
    posts.filter((post) => {

      const text = `
        ${post.text || ""}
        ${post.whySelected || ""}
        ${post.whyRelevantNow || ""}
      `.toLowerCase();

      return text.includes(
        search.toLowerCase()
      );
    });

  return (
    <main className="pageContainer">

      <section className="pageHero">

        <div className="sectionLabel">
          LONG-TERM MEMORY
        </div>

        <h1>
          What Nova remembers.
        </h1>

        <p>
          Every published decision becomes part
          of the agent's persistent editorial
          memory.
        </p>

        <input
          className="memorySearch"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search Nova's memories..."
        />

      </section>

      <div className="memoryStats">

        <StatusCard
          label="MEMORIES"
          value={posts.length}
          detail="Published decisions"
          active
        />

        <StatusCard
          label="STATUS"
          value="ACTIVE"
          detail="Persistent memory"
          active
        />

        <StatusCard
          label="STORAGE"
          value="SQLITE"
          detail="Persistent database"
        />

      </div>

      {filteredPosts.length === 0 ? (
        <div className="stateCard">

          <h3>
            No matching memories
          </h3>

          <p>
            Nova's published decisions will
            appear here.
          </p>

        </div>
      ) : (
        <div className="memoryList">

          {filteredPosts.map((post) => {

            const sources =
              getSources(post.sources);

            return (
              <article
                className="memoryCard"
                key={post.id}
              >

                <div className="memoryNumber">
                  MEMORY
                </div>

                <div className="memoryContent">

                  <span className="sourceTag">
                    AI TECHNOLOGY
                  </span>

                  <h3>
                    {getTitle(post.text)}
                  </h3>

                  <p>
                    {getSummary(post.text)}
                  </p>

                  <div className="memoryMeta">

                    <span>
                      Score:{" "}
                      <strong>
                        {post.score || "—"}
                      </strong>
                    </span>

                    <span>
                      {post.createdAt
                        ? new Date(
                            post.createdAt
                          ).toLocaleString()
                        : ""}
                    </span>

                  </div>

                  {post.whySelected && (
                    <div className="memoryReason">

                      <strong>
                        Why selected
                      </strong>

                      <span>
                        {post.whySelected}
                      </span>

                    </div>
                  )}

                  {sources.length > 0 &&
                    sources[0]?.url && (
                      <a
                        className="readLink"
                        href={
                          sources[0].url
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Read original source →
                      </a>
                    )}

                </div>

              </article>
            );
          })}

        </div>
      )}

    </main>
  );
}

// ==================================================
// PIPELINE STEP
// ==================================================

function PipelineStep({
  number,
  icon,
  title,
  text,
}) {
  return (
    <div className="pipelineStep">

      <span className="stepNumber">
        {number}
      </span>

      <div className="stepIcon">
        {icon}
      </div>

      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>

    </div>
  );
}

// ==================================================
// STATUS CARD
// ==================================================

function StatusCard({
  label,
  value,
  detail,
  active = false,
}) {
  return (
    <div className="statusCard">

      <span className="metricLabel">
        {label}
      </span>

      <strong
        className={
          active
            ? "metricActive"
            : ""
        }
      >
        {value}
      </strong>

      <span className="metricDetail">
        {detail}
      </span>

    </div>
  );
}

// ==================================================
// ACTIVITY ITEM
// ==================================================

function ActivityItem({
  status,
  title,
  text,
}) {
  return (
    <div
      className={
        status === "active"
          ? "activityItem activityActive"
          : "activityItem"
      }
    >

      <div className="activityDot"></div>

      <div className="activityContent">

        <strong>
          {title}
        </strong>

        <p>
          {text}
        </p>

      </div>

      <span className="activityStatus">
        {status === "active"
          ? "RUNNING"
          : "DONE"}
      </span>

    </div>
  );
}

export default App;