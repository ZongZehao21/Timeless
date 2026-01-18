/*
  Timeless NP - Real AI Assistant (Frontend)
  - Chat widget on every page
  - Calls backend on Render
  - Safe website actions only (navigate / scroll)
  - Memory + AskGPT-style reference selection
*/

(() => {
  const API_BASE = "https://timeless-ai-assistant.onrender.com";

  // -------------------------------
  // Client-side memory + selection
  // -------------------------------
  const SESSION_KEY = "timeless_ai_session_id";
  const HISTORY_KEY = "timeless_ai_history_v2";
  const SELECTED_KEY = "timeless_ai_selected_msg_v1";

  const MAX_TURNS = 12; // user+assistant combined

  function uuid() {
    try {
      return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    } catch {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  function getSessionId() {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = uuid();
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return uuid();
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

  function loadSelectedId() {
    try {
      return localStorage.getItem(SELECTED_KEY) || "";
    } catch {
      return "";
    }
  }

  function saveSelectedId(id) {
    try {
      if (!id) localStorage.removeItem(SELECTED_KEY);
      else localStorage.setItem(SELECTED_KEY, id);
    } catch {
      // ignore
    }
  }

  // History objects: { id, role: 'user'|'assistant', text, ts }
  let HISTORY = loadHistory();
  const SESSION_ID = getSessionId();

  // selected assistant message id (AskGPT-style)
  let SELECTED_ID = loadSelectedId();

  function pushTurn(role, text, id = undefined) {
    const clean = String(text || "").trim();
    if (!clean) return;
    HISTORY.push({
      id: id || uuid(),
      role,
      text: clean,
      ts: Date.now()
    });
    HISTORY = HISTORY.slice(-MAX_TURNS);
    saveHistory(HISTORY);
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return node;
  }

  function ensureWidget() {
    if (document.getElementById("ai-fab")) return;

    const fab = el("button", { id: "ai-fab", class: "ai-fab", type: "button", "aria-label": "Open AI Assistant" }, ["AI"]);

    const panel = el("aside", { id: "ai-panel", class: "ai-panel", "aria-hidden": "true" }, [
      el("div", { class: "ai-header" }, [
        el("div", {}, [
          el("div", { class: "ai-title" }, ["Site Assistant"]),
          el("div", { class: "ai-subtitle" }, ["Answers from your content + can navigate"])
        ]),
        el("button", { id: "ai-close", class: "ai-close", type: "button", "aria-label": "Close" }, ["✕"])
      ]),

      // Reference bar
      el("div", { id: "ai-refbar", class: "ai-refbar", "aria-hidden": "true" }, [
        el("div", { class: "ai-reftext", id: "ai-reftext" }, ["Referring to: (none)"]),
        el("button", { id: "ai-refclear", class: "ai-refclear", type: "button" }, ["Clear"])
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

  function setSelectedMessage(msgId) {
    SELECTED_ID = msgId || "";
    saveSelectedId(SELECTED_ID);
    renderRefBar();
    highlightSelectedBubble();
  }

  function getSelectedMessage() {
    if (!SELECTED_ID) return null;
    return HISTORY.find(m => m.id === SELECTED_ID && m.role === "assistant") || null;
  }

  function renderRefBar() {
    const refbar = document.getElementById("ai-refbar");
    const reftext = document.getElementById("ai-reftext");
    if (!refbar || !reftext) return;

    const sel = getSelectedMessage();
    if (!sel) {
      refbar.setAttribute("aria-hidden", "true");
      refbar.classList.remove("show");
      reftext.textContent = "Referring to: (none)";
      return;
    }

    refbar.setAttribute("aria-hidden", "false");
    refbar.classList.add("show");
    const snippet = sel.text.length > 90 ? sel.text.slice(0, 90) + "…" : sel.text;
    reftext.textContent = `Referring to: ${snippet}`;
  }

  function highlightSelectedBubble() {
    const msgs = document.querySelectorAll(".ai-msg.ai[data-msgid]");
    msgs.forEach(n => n.classList.remove("selected"));
    if (!SELECTED_ID) return;
    const selNode = document.querySelector(`.ai-msg.ai[data-msgid="${CSS.escape(SELECTED_ID)}"]`);
    if (selNode) selNode.classList.add("selected");
  }

  function addMessage(role, text, persist = true, msgId = undefined) {
    const messages = document.getElementById("ai-messages");

    const id = msgId || uuid();

    const metaLabel = role === "user" ? "You" : "Assistant";
    const bubble = el("div", {
      class: `ai-msg ${role}`,
      "data-msgid": role === "ai" ? id : ""
    }, [
      el("div", { class: "ai-meta" }, [metaLabel]),
      el("div", { class: "ai-text" }, [text])
    ]);

    // Add per-message actions for assistant replies
    if (role === "ai") {
      const btnRow = el("div", { class: "ai-actions" }, [
        el("button", {
          type: "button",
          class: "ai-actionbtn",
          onclick: () => {
            setSelectedMessage(id);
            addMessage("ai", "Okay — I’ll treat that message as what you’re referring to.", false);
          }
        }, ["Refer"]),

        el("button", {
          type: "button",
          class: "ai-actionbtn",
          onclick: () => {
            setSelectedMessage(id);
            onUser("Summarize it in a short paragraph.");
          }
        }, ["Summarize"]),

        el("button", {
          type: "button",
          class: "ai-actionbtn",
          onclick: () => {
            setSelectedMessage(id);
            onUser("Summarize it in point form (5 to 7 bullets).");
          }
        }, ["Point form"])
      ]);
      bubble.appendChild(btnRow);
    }

    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;

    if (persist) {
      pushTurn(role === "user" ? "user" : "assistant", text, id);
    }

    highlightSelectedBubble();
    return bubble;
  }

  function safeNavigate(path) {
    const allowedBases = [
      "/index.html",
      "/HTML/Our_Past.html",
      "/HTML/User_Stories.html",
      "/HTML/map.html",
      "/HTML/1960_Story.html"
    ];

    const raw = String(path || "").trim();
    if (!raw) return false;

    if (/^(https?:)?\/\//i.test(raw)) return false;
    if (/^javascript:/i.test(raw)) return false;

    const [basePath, hash = ""] = raw.split("#");
    if (!allowedBases.includes(basePath)) return false;

    const segs = window.location.pathname.split("/").filter(Boolean);
    const isGitHubPages = window.location.hostname.endsWith("github.io");
    const reserved = new Set(["HTML", "CSS", "Images", "JavaScript", "img"]);

    let repoPrefix = "";
    if (isGitHubPages && segs.length > 0) {
      const first = segs[0];
      if (!reserved.has(first) && !first.endsWith(".html")) {
        repoPrefix = `/${first}`;
      }
    }

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
        history: HISTORY.slice(-MAX_TURNS).map(m => ({ id: m.id, role: m.role, text: m.text })),
        selectedMessageId: SELECTED_ID || ""
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
    const refClear = document.getElementById("ai-refclear");

    fab.addEventListener("click", () => {
      const panel = document.getElementById("ai-panel");
      panel.classList.contains("open") ? closePanel() : openPanel();
    });

    close.addEventListener("click", closePanel);

    refClear?.addEventListener("click", () => {
      setSelectedMessage("");
      addMessage("ai", "Cleared — I won’t refer to a specific previous message anymore.", false);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      onUser(text);
    });

    // Restore prior conversation in this browser session
    const messages = document.getElementById("ai-messages");
    if (messages && messages.children.length === 0 && HISTORY.length > 0) {
      for (const m of HISTORY) {
        const role = m.role === "user" ? "user" : "ai";
        // Render without re-saving history
        const bubble = el("div", {
          class: `ai-msg ${role}`,
          "data-msgid": role === "ai" ? m.id : ""
        }, [
          el("div", { class: "ai-meta" }, [role === "user" ? "You" : "Assistant"]),
          el("div", { class: "ai-text" }, [m.text])
        ]);

        // Re-add actions for assistant bubbles on restore
        if (role === "ai") {
          const btnRow = el("div", { class: "ai-actions" }, [
            el("button", {
              type: "button",
              class: "ai-actionbtn",
              onclick: () => {
                setSelectedMessage(m.id);
                addMessage("ai", "Okay — I’ll treat that message as what you’re referring to.", false);
              }
            }, ["Refer"]),
            el("button", {
              type: "button",
              class: "ai-actionbtn",
              onclick: () => {
                setSelectedMessage(m.id);
                onUser("Summarize it in a short paragraph.");
              }
            }, ["Summarize"]),
            el("button", {
              type: "button",
              class: "ai-actionbtn",
              onclick: () => {
                setSelectedMessage(m.id);
                onUser("Summarize it in point form (5 to 7 bullets).");
              }
            }, ["Point form"])
          ]);
          bubble.appendChild(btnRow);
        }

        messages.appendChild(bubble);
      }
      messages.scrollTop = messages.scrollHeight;
    }

    if (HISTORY.length === 0) {
      addMessage("ai", "Hi! Ask me about Timeless NP, or type: ‘bring me to contact us page’."); 
    }

    renderRefBar();
    highlightSelectedBubble();
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureWidget();
    wireUI();
  });
})();
