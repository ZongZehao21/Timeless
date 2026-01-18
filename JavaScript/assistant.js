/*
  Timeless NP - Real AI Assistant (Frontend)
  - Injects a chat widget on every page.
  - Calls a local backend (Node/Express) at http://localhost:3001
  - Executes ONLY safe in-page actions (navigate / scroll).

  IMPORTANT:
  - Do NOT put your OpenAI API key in frontend code.
*/

(() => {
  const API_BASE = "https://timeless-ai-assistant.onrender.com";

  // -------------------------------
  // Lightweight client-side memory
  // -------------------------------
  // This lets the assistant handle follow-ups like:
  // User: tell me what happened in 2009
  // User: summarize it in point form
  // by sending the last few turns back to the server.
  //
  // Stored locally in the browser (per device / per browser).
  const SESSION_KEY = "timeless_ai_session_id";
  const HISTORY_KEY = "timeless_ai_history_v1";
  const MAX_TURNS = 12; // last 12 messages (user+assistant combined)

  function getSessionId() {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      // If localStorage is blocked, fall back to an in-memory id.
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_TURNS)));
    } catch {
      // ignore
    }
  }

  // History format we send to the server: [{ role: 'user'|'assistant', text: '...' }, ...]
  let HISTORY = loadHistory();
  const SESSION_ID = getSessionId();

  function pushTurn(role, text) {
    const clean = String(text || "").trim();
    if (!clean) return;
    HISTORY.push({ role, text: clean });
    HISTORY = HISTORY.slice(-MAX_TURNS);
    saveHistory(HISTORY);
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return node;
  }

  function ensureWidget() {
    if (document.getElementById("ai-fab")) return; // already exists

    const fab = el("button", { id: "ai-fab", class: "ai-fab", type: "button", "aria-label": "Open AI Assistant" }, ["AI"]);

    const panel = el("aside", { id: "ai-panel", class: "ai-panel", "aria-hidden": "true" }, [
      el("div", { class: "ai-header" }, [
        el("div", {}, [
          el("div", { class: "ai-title" }, ["Site Assistant"]),
          el("div", { class: "ai-subtitle" }, ["Answers from your content + can navigate"])
        ]),
        el("button", { id: "ai-close", class: "ai-close", type: "button", "aria-label": "Close" }, ["✕"])
      ]),
      el("div", { id: "ai-messages", class: "ai-messages", role: "log", "aria-live": "polite" }),
      el("form", { id: "ai-form", class: "ai-inputbar" }, [
        el("input", { id: "ai-input", type: "text", placeholder: "Ask a question or type a command…", autocomplete: "off" }),
        el("button", { type: "submit" }, ["Send"])
      ]),
      el("div", { class: "ai-hints" }, [
        "Examples: ",
        el("span", {}, ["What is Kickstart Fund?"]),
        el("span", {}, ["bring me to contact us page"]),
        el("span", {}, ["go to map"]),
        el("span", {}, ["scroll to contact"])
      ])
    ]);

    document.body.appendChild(fab);
    document.body.appendChild(panel);
  }

  function openPanel() {
    const panel = document.getElementById("ai-panel");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    setTimeout(() => document.getElementById("ai-input")?.focus(), 0);
  }

  function closePanel() {
    const panel = document.getElementById("ai-panel");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  }

  function addMessage(role, text, persist = true) {
    const messages = document.getElementById("ai-messages");
    const msg = el("div", { class: `ai-msg ${role}` }, [
      el("div", { class: "ai-meta" }, [role === "user" ? "You" : "Assistant"]),
      el("div", { class: "ai-text" }, [text])
    ]);
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;

    // Persist memory for follow-up questions.
    if (persist) pushTurn(role === "user" ? "user" : "assistant", text);

    return msg;
  }

  function safeNavigate(path) {
    // Allow only your real pages (base path WITHOUT any #hash)
    const allowedBases = [
      "/index.html",
      "/HTML/Our_Past.html",
      "/HTML/User_Stories.html",
      "/HTML/map.html",
      "/HTML/1960_Story.html"
    ];

    const raw = String(path || "").trim();
    if (!raw) return false;

    // Block external / javascript: URLs
    if (/^(https?:)?\/\//i.test(raw)) return false;
    if (/^javascript:/i.test(raw)) return false;

    const [basePath, hash = ""] = raw.split("#");
    if (!allowedBases.includes(basePath)) return false;

    // GitHub Pages project sites live under /<repo-name>/...
    // If we navigate to /HTML/... directly, GitHub Pages will 404.
    // This adds the repo prefix automatically when needed.
    const segs = window.location.pathname.split("/").filter(Boolean);
    const isGitHubPages = window.location.hostname.endsWith("github.io");
    const reserved = new Set(["HTML", "CSS", "Images", "JavaScript", "img"]);

    let repoPrefix = "";
    if (isGitHubPages && segs.length > 0) {
      const first = segs[0];
      // If the first segment is not a known folder and not an .html file,
      // treat it as the repo name prefix.
      if (!reserved.has(first) && !first.endsWith(".html")) {
        repoPrefix = `/${first}`;
      }
    }

    // Avoid double-prefixing if it's already there
    let finalPath = basePath;
    if (repoPrefix && !basePath.startsWith(repoPrefix + "/")) {
      finalPath = repoPrefix + basePath;
    }

    const finalUrl = hash ? `${finalPath}#${hash}` : finalPath;
    window.location.href = finalUrl;
    return true;
  }

  function safeScrollTo(selector) {
    const target = document.querySelector(selector);
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  async function callBackend(message) {
    const page = window.location.pathname || "/";
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        page,
        sessionId: SESSION_ID,
        // Send a short conversation window so the AI can refer back.
        history: HISTORY.slice(-MAX_TURNS)
      })
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Backend error (${res.status}). ${t}`);
    }

    return res.json();
  }

  async function handleToolCalls(toolCalls) {
    for (const call of toolCalls) {
      const name = call.name;
      const args = call.arguments || {};

      if (name === "navigate") {
        const ok = safeNavigate(args.path);
        addMessage("ai", ok ? `Okay — taking you to ${args.path}` : "I can’t navigate to that page.");
      } else if (name === "scroll_to") {
        const ok = safeScrollTo(args.selector);
        addMessage("ai", ok ? `Scrolling to ${args.selector}` : "I can’t find that section on this page.");
      } else {
        addMessage("ai", `Unknown tool: ${name}`);
      }
    }
  }

  async function onUser(text) {
    addMessage("user", text);
    const thinking = addMessage("ai", "Thinking…", false);

    try {
      const out = await callBackend(text);
      thinking.remove();

      if (out.type === "tool") {
        await handleToolCalls(out.toolCalls || []);
        return;
      }

      if (out.type === "answer") {
        addMessage("ai", out.text || "(No answer)");
        return;
      }

      addMessage("ai", "I got an unexpected response.");
    } catch (e) {
      thinking.remove();
      addMessage(
        "ai",
        `I couldn’t reach the AI server. If you’re using Render free tier, it may be waking up. Try again in a moment. (API: ${API_BASE})`
      );
      console.error(e);
    }
  }

  function wireUI() {
    const fab = document.getElementById("ai-fab");
    const close = document.getElementById("ai-close");
    const form = document.getElementById("ai-form");
    const input = document.getElementById("ai-input");

    fab.addEventListener("click", () => {
      const panel = document.getElementById("ai-panel");
      panel.classList.contains("open") ? closePanel() : openPanel();
    });

    close.addEventListener("click", closePanel);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      onUser(text);
    });

    // Restore prior conversation in this browser session (optional).
    if (HISTORY.length > 0) {
      // Only render if the chat is empty.
      const messages = document.getElementById("ai-messages");
      if (messages && messages.children.length === 0) {
        for (const m of HISTORY) {
          const role = m.role === "user" ? "user" : "ai";
          // Render without re-saving history (temporary toggle)
          const prev = HISTORY;
          HISTORY = prev; // no-op (kept for clarity)
          const msg = el("div", { class: `ai-msg ${role}` }, [
            el("div", { class: "ai-meta" }, [role === "user" ? "You" : "Assistant"]),
            el("div", { class: "ai-text" }, [m.content])
          ]);
          messages.appendChild(msg);
        }
        messages.scrollTop = messages.scrollHeight;
      }
    }

    if (HISTORY.length === 0) {
      addMessage("ai", "Hi! Ask me about Timeless NP, or type: ‘bring me to contact us page’." );
    }
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    ensureWidget();
    wireUI();
  });
})();
