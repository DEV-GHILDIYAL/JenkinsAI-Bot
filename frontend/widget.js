/* Jenkins Console Output inspector; the gateway authenticates API calls. */
(() => {
  "use strict";
  if (document.getElementById("jenkinsai-inspector")) return;
  const parts = location.pathname.split("/").filter(Boolean);
  const build = Number(parts.at(-2));
  if (!["console", "consoleFull"].includes(parts.at(-1)) || !Number.isSafeInteger(build) || build < 1) return;
  const jobs = [];
  for (let i = 0; i < parts.length - 2; i += 2) {
    if (parts[i] !== "job" || !parts[i + 1]) return;
    try { jobs.push(decodeURIComponent(parts[i + 1])); } catch { return; }
  }
  if (!jobs.length || parts.length !== jobs.length * 2 + 2) return;
  const source = document.currentScript?.src;
  if (!source) return;
  const api = new URL("../api/inspect", source);

  const style = document.createElement("style");
  style.textContent = `
    /* ── Clean Professional Blue Theme ── */
    #jenkinsai-inspector{--bg:#f5f8fd;--fg:#23344d;--muted:#61738b;--border:#d8e3f0;--accent:#3975c9;--accent-hover:#2b62ad;--button:#3975c9;--button-hover:#2b62ad;--accent-soft:#eaf2fc;--good:#138568;--bad:#c74754;--warn:#a96a13;--surface:#ffffff;--code-bg:#f0f4f9;--shadow:0 12px 36px rgba(28,57,96,0.16),0 3px 10px rgba(28,57,96,0.07);position:fixed;right:24px;bottom:20px;z-index:2147483647;color:var(--fg);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
    #jenkinsai-inspector[data-theme=dark]{--bg:#172235;--fg:#e5edf8;--muted:#a6b7ce;--border:#354760;--accent:#79aef8;--accent-hover:#98c0ff;--button:#356fb8;--button-hover:#477fc5;--accent-soft:#233752;--good:#5bd3aa;--bad:#ff8b96;--warn:#f4c36a;--surface:#202f45;--code-bg:#19283c;--shadow:0 12px 36px rgba(0,0,0,0.42),0 3px 10px rgba(0,0,0,0.25)}
    #jenkinsai-inspector *{box-sizing:border-box}

    /* Small Quick Summary Toast above bot */
    #jenkinsai-inspector .ai-toast{position:absolute;bottom:70px;right:0;width:340px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow);animation:ai-slideup .22s cubic-bezier(0.16,1,0.3,1);cursor:pointer;transition:transform .15s ease,border-color .15s}
    #jenkinsai-inspector .ai-toast:hover{transform:translateY(-2px);border-color:var(--accent)}
    #jenkinsai-inspector .ai-toast-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
    #jenkinsai-inspector .ai-badge{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:3px 10px;border-radius:6px;background:rgba(37,99,235,0.1);color:var(--accent)}
    #jenkinsai-inspector[data-verdict=clean] .ai-badge{background:rgba(5,150,105,0.1);color:var(--good)}
    #jenkinsai-inspector[data-verdict=issue] .ai-badge,#jenkinsai-inspector[data-verdict=failed] .ai-badge,#jenkinsai-inspector[data-verdict=error] .ai-badge{background:rgba(220,38,38,0.08);color:var(--bad)}
    #jenkinsai-inspector[data-verdict=uncertain] .ai-badge{background:rgba(217,119,6,0.1);color:var(--warn)}
    #jenkinsai-inspector .ai-toast-close{border:0;background:none;color:var(--muted);font-size:16px;line-height:1;cursor:pointer;padding:0 4px}
    #jenkinsai-inspector .ai-toast-text{margin:0;font-size:12.5px;font-weight:500;line-height:1.5;color:var(--fg)}
    #jenkinsai-inspector .ai-toast-tip{margin:6px 0 0;font-size:11px;color:var(--accent);font-weight:600}

    /* Full Chat Panel */
    #jenkinsai-inspector .ai-chat-panel{width:min(420px,calc(100vw - 36px));height:calc(100vh - 110px);max-height:780px;min-height:460px;display:flex;flex-direction:column;position:absolute;bottom:70px;right:0;background:var(--bg);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);overflow:hidden;animation:ai-slideup .22s cubic-bezier(0.16,1,0.3,1)}
    #jenkinsai-inspector [hidden]{display:none!important}
    #jenkinsai-inspector .ai-panel-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;gap:8px}
    #jenkinsai-inspector .ai-panel-titles{display:flex;flex-direction:column;gap:1px;overflow:hidden}
    #jenkinsai-inspector .ai-user-greeting{font-size:11px;font-weight:600;color:var(--accent);letter-spacing:0.2px}
    #jenkinsai-inspector .ai-panel-titles strong{font-size:13.5px;font-weight:700;color:var(--fg)}
    #jenkinsai-inspector .ai-panel-sub{font-size:10px;font-weight:500;color:var(--muted);margin-left:4px}
    #jenkinsai-inspector .ai-panel-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}
    #jenkinsai-inspector .ai-lang-select{border:1px solid var(--border);background:var(--surface);color:var(--fg);font-size:11px;font-weight:600;border-radius:8px;padding:4px 8px;cursor:pointer;outline:none;transition:border-color .15s}
    #jenkinsai-inspector .ai-lang-select:focus,#jenkinsai-inspector .ai-lang-select:hover{border-color:var(--accent)}
    #jenkinsai-inspector .ai-panel-close{border:0;background:transparent;color:var(--muted);font-size:18px;line-height:1;padding:4px 8px;border-radius:6px;cursor:pointer}
    #jenkinsai-inspector .ai-panel-close:hover{background:var(--accent-soft);color:var(--fg)}

    /* Build Context Banner */
    #jenkinsai-inspector .ai-context-banner{padding:10px 16px;background:var(--accent-soft);border-bottom:1px solid var(--border);font-size:12px;color:var(--fg);line-height:1.4;display:flex;align-items:center;gap:8px;flex-shrink:0}
    #jenkinsai-inspector .ai-context-banner strong{color:var(--accent);font-weight:700}
    #jenkinsai-inspector .ai-context-banner>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    /* Chat Thread */
    #jenkinsai-inspector .ai-thread{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:16px}
    #jenkinsai-inspector .ai-msg{margin:0;font-size:13px;line-height:1.6;overflow-wrap:anywhere;padding:10px 14px;border-radius:12px;max-width:92%}
    #jenkinsai-inspector .ai-msg b{font-weight:700}
    #jenkinsai-inspector .ai-msg[data-role=user]{background:var(--button);color:#ffffff;margin-left:auto;border-bottom-right-radius:4px}
    #jenkinsai-inspector .ai-msg[data-role=model]{background:var(--surface);border:1px solid var(--border);color:var(--fg);border-bottom-left-radius:4px}

    /* Chat Input */
    #jenkinsai-inspector .ai-form{display:flex;gap:8px;align-items:flex-end;padding:12px 16px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0}
    #jenkinsai-inspector .ai-form textarea{flex:1;resize:none;min-height:40px;max-height:100px;border:1px solid var(--border);border-radius:10px;padding:9px 12px;background:var(--bg);color:var(--fg);font:13px/1.45 system-ui,sans-serif;outline:none}
    #jenkinsai-inspector .ai-form textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
    #jenkinsai-inspector .ai-form button[type=submit]{border:none;background:var(--button);color:#fff;border-radius:10px;padding:0 18px;height:40px;font:600 13px system-ui,sans-serif;cursor:pointer;flex-shrink:0;transition:background .15s}
    #jenkinsai-inspector .ai-form button[type=submit]:hover{background:var(--button-hover)}

    /* Quick Prompt Pills */
    #jenkinsai-inspector .ai-quick-prompts{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px 6px;background:var(--bg);flex-shrink:0}
    #jenkinsai-inspector .ai-quick-pill{border:1px solid var(--border);background:var(--surface);color:var(--fg);font-size:11px;font-weight:500;padding:5px 12px;border-radius:20px;cursor:pointer;transition:all .15s ease}
    #jenkinsai-inspector .ai-quick-pill:hover{background:var(--accent);color:#fff;border-color:var(--accent);transform:translateY(-1px)}

    /* Copy Report Button */
    #jenkinsai-inspector .ai-copy-report{border:1px solid var(--border);background:var(--surface);color:var(--accent);font-size:10.5px;font-weight:600;padding:4px 10px;border-radius:6px;cursor:pointer;transition:all .15s;margin-left:auto;white-space:nowrap}
    #jenkinsai-inspector .ai-copy-report:hover{background:var(--accent);color:#fff;border-color:var(--accent)}

    /* Inline Code Blocks */
    #jenkinsai-inspector .ai-code-block{display:flex;align-items:center;gap:6px;background:var(--code-bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:8px 0 4px;font-family:'Cascadia Code','Fira Code','Consolas',monospace;font-size:12px;color:var(--fg);line-height:1.4}
    #jenkinsai-inspector .ai-code-block code{flex:1;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
    #jenkinsai-inspector .ai-code-copy{border:none;background:var(--surface);color:var(--muted);font-size:13px;cursor:pointer;padding:3px 6px;border-radius:5px;flex-shrink:0;transition:all .15s}
    #jenkinsai-inspector .ai-code-copy:hover{color:var(--accent);background:var(--accent-soft)}
    #jenkinsai-inspector .ai-code-copy.copied{color:var(--good)}

    /* Bot Launcher */
    #jenkinsai-inspector .ai-launcher{position:relative;margin-left:auto;width:52px;height:52px;border-radius:50%;border:2px solid var(--accent);background:var(--surface);color:var(--accent);box-shadow:0 6px 20px -4px rgba(37,99,235,0.3);cursor:pointer;padding:0;display:grid;place-items:center;transition:all .2s cubic-bezier(0.34,1.56,0.64,1)}
    #jenkinsai-inspector .ai-launcher:hover{transform:scale(1.08) translateY(-2px);box-shadow:0 8px 24px -4px rgba(37,99,235,0.4)}
    #jenkinsai-inspector .ai-chat-icon{width:25px;height:25px}
    #jenkinsai-inspector[data-verdict=failed] .ai-launcher,#jenkinsai-inspector[data-verdict=issue] .ai-launcher{color:var(--bad);border-color:var(--bad);box-shadow:0 6px 20px -4px rgba(220,38,38,0.25)}
    #jenkinsai-inspector[data-verdict=clean] .ai-launcher{color:var(--good);border-color:var(--good);box-shadow:0 6px 20px -4px rgba(5,150,105,0.25)}

    @keyframes ai-slideup{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:none}}
    #jenkinsai-inspector .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
    #jenkinsai-inspector .ai-msg.ai-diagnosis{max-width:100%;padding:0;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:12px;background:var(--surface);color:var(--fg)!important}
    #jenkinsai-inspector .ai-diagnosis-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;cursor:pointer;list-style:none}
    #jenkinsai-inspector .ai-diagnosis-toggle::-webkit-details-marker{display:none}
    #jenkinsai-inspector .ai-diagnosis-toggle:after{content:"Show";color:var(--accent);font-size:11px;font-weight:600}
    #jenkinsai-inspector .ai-diagnosis[open] .ai-diagnosis-toggle:after{content:"Hide"}
    #jenkinsai-inspector .ai-diagnosis-title{font-size:12px;font-weight:700;color:var(--fg)!important}
    #jenkinsai-inspector .ai-diagnosis-result{font-size:10px;font-weight:650;color:var(--muted);background:var(--accent-soft);padding:3px 7px;border-radius:6px}
    #jenkinsai-inspector .ai-diagnosis-content{padding:0 13px 12px}
    #jenkinsai-inspector .ai-diagnosis-summary{margin:0 0 9px;font-size:13px;line-height:1.5;color:var(--fg)!important}
    #jenkinsai-inspector .ai-diagnosis-row{margin-top:7px;padding-top:7px;border-top:1px solid var(--border);color:var(--fg)!important}
    #jenkinsai-inspector .ai-diagnosis-row strong{display:block;margin-bottom:2px;font-size:10px;color:var(--muted)!important;text-transform:uppercase;letter-spacing:.35px}
    #jenkinsai-inspector .ai-diagnosis-row span{display:block;font-size:12px;line-height:1.5;overflow-wrap:anywhere;color:var(--fg)!important}
    #jenkinsai-inspector[data-verdict=failed] .ai-diagnosis-result,#jenkinsai-inspector[data-verdict=issue] .ai-diagnosis-result{background:#fff0f1;color:var(--bad)}
    #jenkinsai-inspector[data-verdict=clean] .ai-diagnosis-result{background:#eaf7f2;color:var(--good)}
    #jenkinsai-inspector[data-verdict=uncertain] .ai-diagnosis-result{background:#fff5e5;color:var(--warn)}
    #jenkinsai-inspector[data-theme=dark][data-verdict=failed] .ai-diagnosis-result,#jenkinsai-inspector[data-theme=dark][data-verdict=issue] .ai-diagnosis-result{background:#482b39}
    #jenkinsai-inspector[data-theme=dark][data-verdict=clean] .ai-diagnosis-result{background:#1d443e}
    #jenkinsai-inspector[data-theme=dark][data-verdict=uncertain] .ai-diagnosis-result{background:#4b3a27}
    @media(max-width:520px){#jenkinsai-inspector{right:12px;bottom:12px}#jenkinsai-inspector .ai-toast{width:min(340px,calc(100vw - 24px))}#jenkinsai-inspector .ai-chat-panel{width:calc(100vw - 24px);right:0;bottom:64px;height:min(680px,calc(100dvh - 88px));min-height:360px}}
    @media(max-height:560px){#jenkinsai-inspector .ai-chat-panel{height:calc(100dvh - 82px);min-height:300px}#jenkinsai-inspector .ai-quick-prompts{padding-top:5px;padding-bottom:4px}}
    @media(prefers-reduced-motion:reduce){#jenkinsai-inspector *,#jenkinsai-inspector *:before{animation:none!important;transition:none!important}}
  `;
  document.head.append(style);

  const root = document.createElement("div");
  root.id = "jenkinsai-inspector";
  root.dataset.verdict = "loading";
  root.innerHTML = `
    <!-- 1. Quick Summary Toast (appears automatically above bot) -->
    <div class="ai-toast" role="status" aria-live="polite">
      <div class="ai-toast-head">
        <span class="ai-badge"><span class="ai-dot"></span><strong class="ai-badge-text">Diagnosing...</strong></span>
        <button class="ai-toast-close" type="button" aria-label="Dismiss summary">×</button>
      </div>
      <p class="ai-toast-text">Analyzing build console output...</p>
      <div class="ai-toast-tip">Open for evidence and next steps</div>
    </div>

    <!-- 2. Full Dedicated Chat Panel (opens ONLY when user clicks bot) -->
    <section class="ai-chat-panel" hidden role="dialog" aria-label="Jenkins AI Chat">
      <div class="ai-panel-head">
        <div class="ai-panel-titles">
            <span class="ai-user-greeting">BUILD ASSISTANT</span>
            <strong>JenkinsAI <span class="ai-panel-sub">#${build}</span></strong>
        </div>
        <div class="ai-panel-actions">
          <select class="ai-lang-select" aria-label="Select response language" title="Change Language">
            <option value="Hinglish" selected>Hinglish</option>
            <option value="English">English</option>
          </select>
          <button class="ai-panel-close" type="button" aria-label="Close chat">×</button>
        </div>
      </div>
      <div class="ai-context-banner">
        <span><strong class="ai-context-status">Inspecting build...</strong></span>
        <button class="ai-copy-report" type="button" title="Copy build summary to clipboard">Copy summary</button>
      </div>
      <div class="ai-thread" aria-live="polite"></div>
      <div class="ai-quick-prompts">
        <button class="ai-quick-pill" type="button" data-prompt="Explain the error in simple words">Explain the error</button>
        <button class="ai-quick-pill" type="button" data-prompt="Is this a code issue or a Jenkins agent/setup issue?">Code or agent issue?</button>
        <button class="ai-quick-pill" type="button" data-prompt="What should I check or fix next?">What should I do next?</button>
        <button class="ai-quick-pill" type="button" data-prompt="Summarize this build issue briefly">Short summary</button>
      </div>
      <form class="ai-form">
        <label class="sr-only" for="jenkinsai-question">Question</label>
        <textarea id="jenkinsai-question" rows="2" maxlength="12000" placeholder="Ask about this build, or: testing build #12"></textarea>
        <button type="submit">Send</button>
      </form>
    </section>

    <!-- 3. Chat launcher -->
    <button class="ai-launcher" type="button" aria-label="Jenkins AI" aria-expanded="false" title="Jenkins AI Assistant">
      <svg class="ai-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5A7.5 7.5 0 1 1 20 11.5Z"/>
        <path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" stroke-width="2.4"/>
      </svg>
    </button>
  `;
  document.body.append(root);

  const toast = root.querySelector(".ai-toast");
  const toastBadge = root.querySelector(".ai-toast .ai-badge-text");
  const toastText = root.querySelector(".ai-toast-text");
  const toastClose = root.querySelector(".ai-toast-close");
  const chatPanel = root.querySelector(".ai-chat-panel");
  const panelClose = root.querySelector(".ai-panel-close");
  const langSelect = root.querySelector(".ai-lang-select");
  const copyReportBtn = root.querySelector(".ai-copy-report");
  const quickPromptContainer = root.querySelector(".ai-quick-prompts");
  const contextStatus = root.querySelector(".ai-context-status");
  const launcher = root.querySelector(".ai-launcher");
  const thread = root.querySelector(".ai-thread");
  const form = root.querySelector(".ai-form");
  const question = root.querySelector("#jenkinsai-question");
  const chatApi = new URL("../api/chat", source);
  let history = [];
  let chatJob = jobs.join("/");
  let chatBuild = build;
  let chatting = false;
  let cachedDiagnosis = null;
  let welcomeMessage = null;
  let selectedLang = "Hinglish";

  if (langSelect) {
    langSelect.onchange = () => {
      selectedLang = langSelect.value;
      if (thread && thread.children.length) {
        addChat("model", selectedLang === "Hinglish"
          ? "Jawab Hinglish mein honge."
          : "Replies will be in English."
        );
      }
    };
  }

  function syncTheme() {
    const themeElements = [document.documentElement, document.body];
    const darkClass = themeElements.some(element => /(^|[\s_-])dark([\s_-]|$)/i.test(element.className?.baseVal || element.className || ""));
    const declaredTheme = themeElements.map(element => element.getAttribute("data-theme") || element.getAttribute("theme"))
      .find(value => value && /^(light|dark)$/i.test(value));
    let darkBackground = false;
    let pageBackgroundDetected = false;
    for (let element = document.body; element; element = element.parentElement) {
      const background = getComputedStyle(element).backgroundColor;
      const match = background.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)$/i);
      if (!match || (match[4] !== undefined && Number(match[4]) === 0)) continue;
      pageBackgroundDetected = true;
      const [red, green, blue] = match.slice(1, 4).map(Number);
      darkBackground = (0.2126 * red + 0.7152 * green + 0.0722 * blue) < 128;
      break;
    }
    const dark = declaredTheme
      ? declaredTheme.toLowerCase() === "dark"
      : darkClass || (pageBackgroundDetected ? darkBackground : matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "dark" : "light";
  }
  syncTheme();
  const themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ["class", "style", "data-theme", "theme"]});
  themeObserver.observe(document.body, {attributes: true, attributeFilter: ["class", "style", "data-theme", "theme"]});
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTheme);

  async function errorMessage(response, action) {
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail;
    } catch { /* Fall back to a short status message for non-JSON proxy responses. */ }
    return `${action} (HTTP ${response.status}).`;
  }

  // Toggle Chat Panel on Launcher Click
  launcher.onclick = () => {
    if (chatPanel.hidden) {
      toast.hidden = true;
      chatPanel.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      if (!thread.children.length) {
        if (cachedDiagnosis) {
          addDiagnosis(cachedDiagnosis);
        } else {
          addChat("model", "Yeh Jenkins build assistant hai. Main current build ka issue, log evidence aur next step simple words mein samjha sakta hoon.");
          welcomeMessage = thread.lastElementChild;
        }
      }
      setTimeout(() => question.focus(), 60);
    } else {
      chatPanel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
    }
  };

  // Clicking toast opens chat directly
  toast.onclick = (e) => {
    if (e.target === toastClose) {
      toast.hidden = true;
      return;
    }
    launcher.click();
  };
  toastClose.onclick = () => { toast.hidden = true; };
  panelClose.onclick = () => { chatPanel.hidden = true; launcher.setAttribute("aria-expanded", "false"); };
  // Render markdown-lite: **bold**, `code`, newlines, bullet points
  function renderMarkdown(text) {
    // Split on backtick commands, bold markers, and newlines
    const html = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\n\* /g, "\n• ")
      .replace(/\n/g, "<br>");
    return html;
  }

  function addChat(role, text) {
    const node = document.createElement("div");
    node.className = "ai-msg";
    node.dataset.role = role;
    if (role === "model") {
      // Split into backtick code segments and text segments
      const segments = text.split(/(`.+?`)/g);
      segments.forEach(seg => {
        if (/^`.+`$/.test(seg)) {
          const cmd = seg.slice(1, -1);
          const block = document.createElement("div");
          block.className = "ai-code-block";
          const codeEl = document.createElement("code");
          codeEl.textContent = cmd;
          const copyBtn = document.createElement("button");
          copyBtn.type = "button";
          copyBtn.className = "ai-code-copy";
          copyBtn.textContent = "Copy";
          copyBtn.title = "Copy";
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(cmd).then(() => {
              copyBtn.textContent = "Copied";
              copyBtn.classList.add("copied");
              setTimeout(() => { copyBtn.textContent = "Copy"; copyBtn.classList.remove("copied"); }, 1500);
            });
          };
          block.append(codeEl, copyBtn);
          node.append(block);
        } else if (seg.trim()) {
          const span = document.createElement("span");
          span.innerHTML = renderMarkdown(seg);
          node.append(span);
        }
      });
    } else {
      node.textContent = text;
    }
    thread.append(node);
    thread.scrollTop = thread.scrollHeight;
    if (role === "user" && quickPromptContainer) {
      quickPromptContainer.hidden = true;
    }
  }
  function createDiagnosisCard(data) {
    const card = document.createElement("details");
    card.className = "ai-msg ai-diagnosis";
    card.dataset.role = "model";
    const head = document.createElement("summary");
    head.className = "ai-diagnosis-toggle";
    const headingGroup = document.createElement("span");
    const heading = document.createElement("strong");
    heading.className = "ai-diagnosis-title";
    heading.textContent = `Build #${data.build || build}`;
    const status = document.createElement("span");
    status.className = "ai-diagnosis-result";
    status.textContent = `${({FAILED: "Build failed", ISSUE: "Issue found", CLEAN: "No issue found", UNCERTAIN: "Needs review"})[data.verdict] || "Build status"} · ${data.jenkins_result || "UNKNOWN"}`;
    headingGroup.append(heading, document.createTextNode(" · "), status);
    head.append(headingGroup);
    card.append(head);
    const content = document.createElement("div");
    content.className = "ai-diagnosis-content";
    const summary = document.createElement("p");
    summary.className = "ai-diagnosis-summary";
    summary.textContent = data.summary || "Review the build log.";
    content.append(summary);
    const category = data.category === "APPLICATION"
      ? "Application code"
      : data.category === "DEVOPS" ? "Jenkins / agent setup" : "Needs review";
    const rows = [
      ["Issue type", category],
      ["Evidence", data.evidence],
      ["Next step", data.next],
      ["Previous match", data.memory_match ? `${data.memory_match.root_cause} (from ${data.memory_match.source_job} #${data.memory_match.source_build})` : ""],
    ];
    for (const [label, value] of rows) {
      if (!value || value === "None") continue;
      const row = document.createElement("div");
      row.className = "ai-diagnosis-row";
      const title = document.createElement("strong");
      title.textContent = label;
      const content = document.createElement("span");
      content.textContent = value;
      row.append(title, content);
      content.append(row);
    }
    if (data.partial_log) {
      const row = document.createElement("div");
      row.className = "ai-diagnosis-row";
      row.textContent = "This is a partial log. Check the full console before acting.";
      content.append(row);
    }
    card.append(content);
    return card;
  }
  function addDiagnosis(data) {
    thread.append(createDiagnosisCard(data));
    thread.scrollTop = thread.scrollHeight;
  }
  async function submitQuestion(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }
    const text = question.value.trim();
    if (!text || chatting) return false;
    const userPrompt = selectedLang === "English"
      ? `${text} (Please reply strictly in English)`
      : `${text} (Hinglish mein reply karein)`;
    const candidate = [...history.slice(-16), {role: "user", content: userPrompt}];
    const previousJob = chatJob;
    const previousBuild = chatBuild;
    addChat("user", text);
    question.value = "";
    chatting = true;
    const btn = form.querySelector("button");
    if (btn) btn.disabled = true;
    try {
      const response = await fetch(chatApi, {method: "POST", credentials: "same-origin", headers: {"Content-Type": "application/json"}, body: JSON.stringify({messages: candidate, job: chatJob, build: chatBuild, share_logs: true})});
      if (!response.ok) throw new Error(response.status === 429 ? "Analysis busy. Try again shortly." : await errorMessage(response, "Could not answer"));
      const data = await response.json();
      const answer = data.answer || (selectedLang === "Hinglish" 
        ? "Main sirf is Jenkins build se jude sawaalon ka jawab deta hoon." 
        : "I only answer questions about this Jenkins build.");
      if (!data.refused) {
        const switchedBuild = data.job && data.build && (data.job !== previousJob || data.build !== previousBuild);
        const conversation = switchedBuild ? [candidate[candidate.length - 1]] : candidate;
        history = [...conversation, {role: "model", content: String(answer).slice(0, 12000)}];
        chatJob = data.job || chatJob;
        chatBuild = data.build || chatBuild;
        const panelBuild = root.querySelector(".ai-panel-sub");
        if (panelBuild) panelBuild.textContent = `${chatJob} #${chatBuild}`;
        if (contextStatus) contextStatus.textContent = `${chatJob} #${chatBuild}${data.context?.result ? ` · ${data.context.result}` : ""}`;
      }
      const prior = data.memory_match
        ? `Prior matching diagnosis (verify against this build): ${data.memory_match.root_cause} (from ${data.memory_match.source_job} #${data.memory_match.source_build}).\n`
        : "";
      addChat("model", `${data.job && data.build ? `${data.job} #${data.build}\n` : ""}${prior}${answer}`);
    } catch (error) {
      addChat("model", error.message || "Try again.");
    } finally {
      chatting = false;
      if (btn) btn.disabled = false;
      question.focus();
    }
    return false;
  }
  form.onsubmit = submitQuestion;
  form.addEventListener("submit", submitQuestion, true);
  const sendBtn = form.querySelector("button");
  if (sendBtn) {
    sendBtn.onclick = submitQuestion;
    sendBtn.addEventListener("click", submitQuestion, true);
  }
  question.onkeydown = event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      submitQuestion(event);
    }
  };

  // Quick Prompt Pills — click to auto-send
  if (quickPromptContainer) {
    quickPromptContainer.addEventListener("click", (e) => {
      const pill = e.target.closest(".ai-quick-pill");
      if (!pill) return;
      const prompt = pill.dataset.prompt;
      if (!prompt || chatting) return;
      question.value = prompt;
      submitQuestion();
    });
  }

  // Copy Jira / Slack Bug Report
  if (copyReportBtn) {
    copyReportBtn.onclick = () => {
      if (!cachedDiagnosis) {
        copyReportBtn.textContent = "Please wait";
        setTimeout(() => { copyReportBtn.textContent = "Copy summary"; }, 1200);
        return;
      }
      const d = cachedDiagnosis;
      const catTag = d.category === "APPLICATION" ? "APPLICATION CODE ISSUE (Dev Action Required)"
        : d.category === "DEVOPS" ? "DEVOPS / INFRA ISSUE (Infra Team Action)" : "UNCERTAIN";
      const report = [
        `Jenkins build summary`,
        `Job: ${d.job || jobs.join("/")} #${d.build || build}`,
        `Result: ${d.jenkins_result || d.verdict}`,
        `Issue type: ${catTag}`,
        `Problem: ${d.summary || "Not available"}`,
        `Evidence: ${d.evidence || "Not available"}`,
        `Next step: ${d.next || "Not available"}`,
        `Generated by JenkinsAI`
      ].join("\n");
      navigator.clipboard.writeText(report).then(() => {
        copyReportBtn.textContent = "Copied";
        setTimeout(() => { copyReportBtn.textContent = "Copy summary"; }, 2000);
      }).catch(() => {
        copyReportBtn.textContent = "Copy failed";
        setTimeout(() => { copyReportBtn.textContent = "Copy summary"; }, 2000);
      });
    };
  }
  let timer;
  async function inspect() {
    clearTimeout(timer);
    root.dataset.verdict = "loading";
    if (contextStatus) contextStatus.textContent = `${jobs.join("/")} #${build} · Inspecting`;
    if (toastBadge) toastBadge.textContent = "Diagnosing...";
    if (toastText) toastText.textContent = `JenkinsAI is reading Build #${build}...`;

    try {
      const response = await fetch(api, {
        method: "POST",
        credentials: "same-origin",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({job: jobs.join("/"), build})
      });
      if (!response.ok) {
        throw new Error(response.status === 429 ? "Analysis busy. Try again shortly." : await errorMessage(response, "Could not analyze build"));
      }
      const data = await response.json();
      if (data.status === "running") {
        if (contextStatus) contextStatus.textContent = `${jobs.join("/")} #${build} · Running`;
        if (toastBadge) toastBadge.textContent = "Running";
        if (toastText) toastText.textContent = "I’ll check the console as soon as this build run finishes.";
        timer = setTimeout(inspect, 10000);
        return;
      }

      cachedDiagnosis = data;
      root.dataset.verdict = (data.verdict || "unknown").toLowerCase();

      // Update Quick Summary Toast (compact popup above bot)
      if (toastBadge) toastBadge.textContent = ({
        CLEAN: "No issue found",
        ISSUE: "Issue found",
        FAILED: "Build failed",
        UNCERTAIN: "Needs review"
      })[data.verdict] || "Build status";
      if (toastText) toastText.textContent = data.summary || "Build finished.";
      if (contextStatus) {
        const category = data.category === "APPLICATION" ? "App code" : data.category === "DEVOPS" ? "Jenkins / agent" : "";
        contextStatus.textContent = `${jobs.join("/")} #${build} · ${data.jenkins_result || "UNKNOWN"}${category ? ` · ${category}` : ""}`;
      }

      // Update chat thread with initial diagnosis summary if not already populated
      if (thread && welcomeMessage && welcomeMessage.isConnected) {
        welcomeMessage.replaceWith(createDiagnosisCard(data));
        welcomeMessage = null;
      } else if (thread && !thread.children.length) {
        addDiagnosis(data);
      }

      // If user hasn't opened chat yet, keep toast visible
      if (chatPanel && chatPanel.hidden && toast) {
        toast.hidden = false;
      }
    } catch (error) {
      root.dataset.verdict = "error";
      if (toastBadge) toastBadge.textContent = "Error";
      if (toastText) toastText.textContent = error.message || "Could not analyze build.";
      if (contextStatus) contextStatus.textContent = "Analysis unavailable";
      if (chatPanel && chatPanel.hidden && toast) {
        toast.hidden = false;
      }
    }
  }

  inspect();
})();
