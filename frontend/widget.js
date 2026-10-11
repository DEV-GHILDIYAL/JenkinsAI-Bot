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
    #jenkinsai-inspector{--bg:#1e2430;--fg:#f1f5f9;--muted:#94a3b8;--border:#334155;--accent:#3b82f6;--accent-hover:#2563eb;--accent-soft:rgba(59,130,246,0.14);--good:#10b981;--bad:#ef4444;--warn:#f59e0b;--surface:#151a23;--code-bg:#0f131a;--shadow:0 24px 60px -8px rgba(0,0,0,0.65),0 8px 24px rgba(0,0,0,0.4);position:fixed;right:24px;bottom:20px;z-index:2147483647;color:var(--fg);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
    #jenkinsai-inspector[data-theme=light]{--bg:#ffffff;--fg:#0f172a;--muted:#64748b;--border:#e2e8f0;--accent:#2563eb;--accent-hover:#1d4ed8;--accent-soft:rgba(37,99,235,0.08);--good:#059669;--bad:#dc2626;--warn:#d97706;--surface:#f8fafc;--code-bg:#f1f5f9;--shadow:0 20px 48px -6px rgba(0,0,0,0.2),0 6px 18px rgba(0,0,0,0.08)}
    #jenkinsai-inspector *{box-sizing:border-box}

    /* Small Quick Summary Toast above bot */
    #jenkinsai-inspector .ai-toast{position:absolute;bottom:70px;right:0;width:340px;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px 14px;box-shadow:var(--shadow);backdrop-filter:blur(16px);animation:ai-slideup .22s cubic-bezier(0.16,1,0.3,1);cursor:pointer;transition:transform .15s ease}
    #jenkinsai-inspector .ai-toast:hover{transform:translateY(-2px);border-color:var(--accent)}
    #jenkinsai-inspector .ai-toast-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
    #jenkinsai-inspector .ai-badge{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:2px 8px;border-radius:5px;background:rgba(59,130,246,0.15);color:var(--accent)}
    #jenkinsai-inspector[data-verdict=clean] .ai-badge{background:rgba(16,185,129,0.15);color:var(--good)}
    #jenkinsai-inspector[data-verdict=issue] .ai-badge,#jenkinsai-inspector[data-verdict=failed] .ai-badge,#jenkinsai-inspector[data-verdict=error] .ai-badge{background:rgba(239,68,68,0.15);color:var(--bad)}
    #jenkinsai-inspector[data-verdict=uncertain] .ai-badge{background:rgba(245,158,11,0.15);color:var(--warn)}
    #jenkinsai-inspector .ai-toast-close{border:0;background:none;color:var(--muted);font-size:16px;line-height:1;cursor:pointer;padding:0 4px}
    #jenkinsai-inspector .ai-toast-text{margin:0;font-size:12.5px;font-weight:600;line-height:1.45;color:var(--fg)}
    #jenkinsai-inspector .ai-toast-tip{margin:6px 0 0;font-size:11px;color:var(--accent);font-weight:550}

    /* Full Chat Dialog */
    #jenkinsai-inspector .ai-chat-panel{width:min(450px,calc(100vw - 36px));height:calc(100vh - 110px);max-height:840px;min-height:500px;display:flex;flex-direction:column;position:absolute;bottom:70px;right:0;background:var(--bg);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);overflow:hidden;animation:ai-slideup .22s cubic-bezier(0.16,1,0.3,1)}
    #jenkinsai-inspector [hidden]{display:none!important}
    #jenkinsai-inspector .ai-panel-head{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}
    #jenkinsai-inspector .ai-panel-titles{flex:1;display:flex;align-items:center;gap:8px}
    #jenkinsai-inspector .ai-panel-titles strong{font-size:13.5px;font-weight:600}
    #jenkinsai-inspector .ai-panel-titles span{font-size:11px;color:var(--muted)}
    #jenkinsai-inspector .ai-panel-close{border:0;background:transparent;color:var(--muted);font-size:18px;line-height:1;padding:4px 8px;border-radius:6px;cursor:pointer}
    #jenkinsai-inspector .ai-panel-close:hover{background:var(--accent-soft);color:var(--fg)}
    
    /* Build Context Card inside chat */
    #jenkinsai-inspector .ai-context-banner{padding:10px 14px;background:var(--accent-soft);border-bottom:1px solid var(--border);font-size:12px;color:var(--fg);line-height:1.4;display:flex;align-items:center;gap:8px;flex-shrink:0}
    #jenkinsai-inspector .ai-context-banner strong{color:var(--accent)}

    /* Chat Thread & Input */
    #jenkinsai-inspector .ai-thread{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:14px 16px;background:var(--bg)}
    #jenkinsai-inspector .ai-msg{margin:0;font-size:12.5px;line-height:1.55;overflow-wrap:anywhere;padding:9px 13px;border-radius:10px}
    #jenkinsai-inspector .ai-msg[data-role=user]{background:var(--accent);color:#ffffff;margin-left:32px;border-bottom-right-radius:2px}
    #jenkinsai-inspector .ai-msg[data-role=model]{background:var(--surface);border:1px solid var(--border);color:var(--fg);border-bottom-left-radius:2px}
    #jenkinsai-inspector .ai-form{display:flex;gap:8px;align-items:flex-end;padding:12px 16px;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0}
    #jenkinsai-inspector .ai-form textarea{flex:1;resize:none;min-height:42px;max-height:110px;border:1px solid var(--border);border-radius:8px;padding:9px 12px;background:var(--bg);color:var(--fg);font:12.5px/1.45 system-ui,sans-serif;outline:none}
    #jenkinsai-inspector .ai-form textarea:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
    #jenkinsai-inspector .ai-form button{border:none;background:var(--accent);color:#fff;border-radius:8px;padding:0 16px;height:42px;font:600 12.5px system-ui,sans-serif;cursor:pointer;flex-shrink:0}
    #jenkinsai-inspector .ai-form button:hover{background:var(--accent-hover)}

    /* Expressive Bot Face Launcher Button */
    #jenkinsai-inspector .ai-launcher{position:relative;margin-left:auto;width:56px;height:56px;border-radius:50%;border:2px solid var(--border);background:var(--bg);color:var(--accent);box-shadow:0 8px 24px -4px rgba(0,0,0,0.4);cursor:pointer;padding:0;display:grid;place-items:center;transition:all .2s cubic-bezier(0.34,1.56,0.64,1)}
    #jenkinsai-inspector .ai-launcher:hover{transform:scale(1.1) translateY(-2px);border-color:var(--accent);box-shadow:0 10px 28px -4px rgba(59,130,246,0.45)}
    #jenkinsai-inspector .ai-face-svg{width:36px;height:36px}
    #jenkinsai-inspector .ai-eye{transform-origin:center;animation:ai-blink 4s infinite}
    #jenkinsai-inspector .ai-mouth{transition:all .2s ease}
    /* Expressions based on verdict */
    #jenkinsai-inspector[data-verdict=failed] .ai-launcher,#jenkinsai-inspector[data-verdict=issue] .ai-launcher{color:var(--bad);border-color:rgba(239,68,68,0.5)}
    #jenkinsai-inspector[data-verdict=clean] .ai-launcher{color:var(--good);border-color:rgba(16,185,129,0.5)}
    #jenkinsai-inspector[data-verdict=loading] .ai-face-svg{animation:ai-headshake 1.5s ease-in-out infinite}
    
    @keyframes ai-slideup{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:none}}
    @keyframes ai-blink{0%,45%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(0.1)}}
    @keyframes ai-headshake{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
    #jenkinsai-inspector .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
    @media(prefers-reduced-motion:reduce){#jenkinsai-inspector *,#jenkinsai-inspector *:before{animation:none!important}}
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
      <div class="ai-toast-tip">Click bot to chat 💬</div>
    </div>

    <!-- 2. Full Dedicated Chat Panel (opens ONLY when user clicks bot) -->
    <section class="ai-chat-panel" hidden role="dialog" aria-label="Jenkins AI Chat">
      <div class="ai-panel-head">
        <div class="ai-panel-titles">
          <strong>Jenkins AI Assistant</strong>
          <span class="ai-panel-sub">Build #${build}</span>
        </div>
        <button class="ai-panel-close" type="button" aria-label="Close chat">×</button>
      </div>
      <div class="ai-context-banner">
        <span>Build Status: <strong class="ai-context-status">Inspecting...</strong></span>
      </div>
      <div class="ai-thread" aria-live="polite"></div>
      <form class="ai-form">
        <label class="sr-only" for="jenkinsai-question">Question</label>
        <textarea id="jenkinsai-question" rows="2" maxlength="12000" placeholder="Ask anything about this build or other pipelines..."></textarea>
        <button type="submit">Send</button>
      </form>
    </section>

    <!-- 3. Expressive Robot Face Launcher Button -->
    <button class="ai-launcher" type="button" aria-label="Jenkins AI" aria-expanded="false" title="Jenkins AI Assistant">
      <svg class="ai-face-svg" viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- Robot Head Box -->
        <rect x="4" y="8" width="28" height="22" rx="6" fill="var(--surface)" stroke="currentColor"/>
        <!-- Antenna -->
        <path d="M18 8V3m-2 0h4" stroke-width="2"/>
        <!-- Eyes -->
        <circle class="ai-eye" cx="12" cy="17" r="2.2" fill="currentColor"/>
        <circle class="ai-eye" cx="24" cy="17" r="2.2" fill="currentColor"/>
        <!-- Expressive Mouth -->
        <path class="ai-mouth" d="M13 23h10"/>
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
  const contextStatus = root.querySelector(".ai-context-status");
  const launcher = root.querySelector(".ai-launcher");
  const mouth = root.querySelector(".ai-mouth");
  const thread = root.querySelector(".ai-thread");
  const form = root.querySelector(".ai-form");
  const question = root.querySelector("#jenkinsai-question");
  const chatApi = new URL("../api/chat", source);
  let history = [];
  let chatJob = jobs.join("/");
  let chatBuild = build;
  let chatting = false;
  let cachedDiagnosis = null;

  function syncTheme() {
    const marker = `${document.documentElement.dataset.theme || ""} ${document.documentElement.className} ${document.body.className}`.toLowerCase();
    if (/\bdark\b/.test(marker)) root.dataset.theme = "dark";
    else if (/\blight\b/.test(marker)) root.dataset.theme = "light";
    else {
      const bg = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)?.map(Number);
      root.dataset.theme = bg?.length >= 3 && (!bg[3] || bg[3] > 0) ? ((bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000 < 130 ? "dark" : "light") : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, {attributes: true, attributeFilter: ["class", "style", "data-theme"]});
  new MutationObserver(syncTheme).observe(document.body, {attributes: true, attributeFilter: ["class", "style", "data-theme"]});
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTheme);

  // Toggle Chat Panel on Launcher Click
  launcher.onclick = () => {
    if (chatPanel.hidden) {
      toast.hidden = true; // Dismiss quick summary toast when chat opens
      chatPanel.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      if (!thread.children.length) {
        if (cachedDiagnosis) {
          addChat("model", `Build #${build} Summary:\n${cachedDiagnosis.summary}\n\nEvidence: ${cachedDiagnosis.evidence || "None"}\nNext: ${cachedDiagnosis.next || "None"}`);
        } else {
          addChat("model", "Hello! Main is build ka console monitor kar raha hoon. Koi bhi sawaal pooch sakte hain.");
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
  function addChat(role, text) {
    const node = document.createElement("p");
    node.className = "ai-msg";
    node.dataset.role = role;
    node.textContent = text;
    thread.append(node);
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
    const candidate = [...history.slice(-16), {role: "user", content: text}];
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
      const answer = data.answer || "I only answer questions about this Jenkins build.";
      if (!data.refused) {
        const switchedBuild = data.job && data.build && (data.job !== previousJob || data.build !== previousBuild);
        const conversation = switchedBuild ? [candidate[candidate.length - 1]] : candidate;
        history = [...conversation, {role: "model", content: String(answer).slice(0, 12000)}];
        chatJob = data.job || chatJob;
        chatBuild = data.build || chatBuild;
      }
      const prior = data.memory_match
        ? `Prior confirmed match: ${data.memory_match.root_cause} (saved from ${data.memory_match.source_job} #${data.memory_match.source_build}).\n`
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
  let timer;
  async function inspect() {
    clearTimeout(timer);
    root.dataset.verdict = "loading";
    title.textContent = "Checking console…";
    result.textContent = `Build #${build}`;
    summary.textContent = "JenkinsAI is reading this build.";
    evidence.hidden = next.hidden = true;
    memoryNote.hidden = true;
    remember.hidden = true;
    try {
      const response = await fetch(api, {method: "POST", credentials: "same-origin", headers: {"Content-Type": "application/json"}, body: JSON.stringify({job: jobs.join("/"), build})});
      if (!response.ok) throw new Error(response.status === 429 ? "Analysis busy. Try again shortly." : await errorMessage(response, "Could not analyze build"));
      const data = await response.json();
      if (data.status === "running") {
        title.textContent = "Pipeline running";
        summary.textContent = "I’ll check the console when this run finishes.";
        ask.hidden = true;
        chat.hidden = true;
        ask.textContent = "Ask about this build";
        timer = setTimeout(inspect, 15000);
        return;
      }
      ask.hidden = false;
      chat.hidden = false;
      ask.textContent = "Hide chat";
      if (!thread.children.length) {
        addChat("model", "Ask about this build, or name another pipeline and build number. JenkinsAI answers build questions.");
      }
      cachedDiagnosis = data;
      root.dataset.verdict = data.verdict.toLowerCase();
      const catLabel = data.category === "APPLICATION"
        ? "App Code Issue"
        : (data.category === "DEVOPS" ? "DevOps / Infra Issue" : "");
      
      // Update Expressive Mouth based on build outcome
      if (mouth) {
        if (data.verdict === "CLEAN") {
          mouth.setAttribute("d", "M12 21q6 4 12 0"); // Smile :)
        } else if (data.verdict === "FAILED" || data.verdict === "ISSUE") {
          mouth.setAttribute("d", "M12 24q6 -4 12 0"); // Frown :(
        } else {
          mouth.setAttribute("d", "M13 23h10"); // Neutral :|
        }
      }

      // Update Quick Summary Toast (compact popup above bot)
      toastBadge.textContent = catLabel || data.verdict;
      toastText.textContent = data.summary || "Build finished.";
      contextStatus.textContent = `${data.jenkins_result || "UNKNOWN"}${catLabel ? ` · ${catLabel}` : ""}`;
      
      // If user hasn't opened chat yet, keep toast visible
      if (chatPanel.hidden) {
        toast.hidden = false;
      }
    } catch (error) {
      root.dataset.verdict = "error";
      if (mouth) mouth.setAttribute("d", "M12 24q6 -4 12 0");
      toastBadge.textContent = "Error";
      toastText.textContent = error.message || "Could not analyze build.";
      contextStatus.textContent = "Analysis unavailable";
      if (chatPanel.hidden) {
        toast.hidden = false;
      }
    }
  }
  remember.onclick = async () => {
    if (remember.disabled || !window.confirm("Save this redacted cause and next step on the JenkinsAI server for future matching errors? Raw logs will not be saved.")) return;
    remember.disabled = true;
    try {
      const nextStep = next.textContent.replace(/^Next:\s*/, "") || "Verify the cited evidence on a future matching build.";
      const response = await fetch(memoryApi, {method: "POST", credentials: "same-origin", headers: {"Content-Type": "application/json"}, body: JSON.stringify({job: jobs.join("/"), build, root_cause: summary.textContent, next_step: nextStep})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `Could not save diagnosis (${response.status}).`);
      remembered = true;
      memoryNote.textContent = "Saved on the server for future matching errors. Raw logs were not saved.";
      memoryNote.hidden = false;
      remember.textContent = data.saved ? "Remembered on server" : "Already remembered";
    } catch (error) {
      remember.disabled = false;
      remember.textContent = error.message || "Could not save";
    }
  };
  inspect();
})();
