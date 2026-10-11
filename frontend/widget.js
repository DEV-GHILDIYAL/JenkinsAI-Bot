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
    #jenkinsai-inspector{--bg:#1e2430;--fg:#f1f5f9;--muted:#94a3b8;--border:#334155;--accent:#3b82f6;--accent-hover:#2563eb;--accent-soft:rgba(59,130,246,0.12);--good:#10b981;--bad:#ef4444;--warn:#f59e0b;--surface:#151a23;--code-bg:#0f131a;--shadow:0 24px 60px -8px rgba(0,0,0,0.65),0 8px 24px rgba(0,0,0,0.4);position:fixed;right:24px;bottom:20px;z-index:2147483647;color:var(--fg);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
    #jenkinsai-inspector[data-theme=light]{--bg:#ffffff;--fg:#0f172a;--muted:#64748b;--border:#e2e8f0;--accent:#2563eb;--accent-hover:#1d4ed8;--accent-soft:rgba(37,99,235,0.08);--good:#059669;--bad:#dc2626;--warn:#d97706;--surface:#f8fafc;--code-bg:#f1f5f9;--shadow:0 20px 48px -6px rgba(0,0,0,0.2),0 6px 18px rgba(0,0,0,0.08)}
    #jenkinsai-inspector *{box-sizing:border-box}
    #jenkinsai-inspector .ai-popup{width:min(460px,calc(100vw - 36px));height:calc(100vh - 110px);max-height:860px;min-height:520px;display:flex;flex-direction:column;margin:0 0 14px auto;background:var(--bg);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow);overflow:hidden;animation:ai-slideup .2s cubic-bezier(0.16,1,0.3,1)}
    #jenkinsai-inspector .ai-popup[hidden],#jenkinsai-inspector [hidden]{display:none!important}
    #jenkinsai-inspector .ai-head{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}
    #jenkinsai-inspector .ai-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:3px 9px;border-radius:6px;background:rgba(59,130,246,0.15);color:var(--accent)}
    #jenkinsai-inspector[data-verdict=clean] .ai-badge{background:rgba(16,185,129,0.15);color:var(--good)}
    #jenkinsai-inspector[data-verdict=issue] .ai-badge,#jenkinsai-inspector[data-verdict=failed] .ai-badge,#jenkinsai-inspector[data-verdict=error] .ai-badge{background:rgba(239,68,68,0.15);color:var(--bad)}
    #jenkinsai-inspector[data-verdict=uncertain] .ai-badge{background:rgba(245,158,11,0.15);color:var(--warn)}
    #jenkinsai-inspector .ai-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
    #jenkinsai-inspector .ai-head-titles{flex:1;display:flex;align-items:center;gap:8px;overflow:hidden}
    #jenkinsai-inspector .ai-head strong{font-size:13.5px;font-weight:600;letter-spacing:-0.2px;white-space:nowrap}
    #jenkinsai-inspector .ai-result{font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #jenkinsai-inspector button{cursor:pointer;transition:all .15s ease}
    #jenkinsai-inspector .ai-close{border:0;background:transparent;color:var(--muted);font-size:18px;line-height:1;padding:4px 8px;border-radius:6px;flex-shrink:0}
    #jenkinsai-inspector .ai-close:hover{background:var(--accent-soft);color:var(--fg)}
    #jenkinsai-inspector .ai-body{padding:14px 18px 12px;overflow-y:auto;flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border)}
    #jenkinsai-inspector .ai-summary{margin:0 0 10px;font-size:14px;font-weight:600;line-height:1.5;color:var(--fg)}
    #jenkinsai-inspector .ai-evidence,#jenkinsai-inspector .ai-next{margin:8px 0;padding:9px 12px;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--fg);font-size:12px;overflow-wrap:anywhere;line-height:1.55}
    #jenkinsai-inspector .ai-evidence{border-left:3px solid var(--bad);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:var(--code-bg);font-size:11.5px}
    #jenkinsai-inspector .ai-next{border-left:3px solid var(--accent)}
    #jenkinsai-inspector .ai-memory{margin:6px 0;padding:7px 11px;border-radius:8px;background:var(--accent-soft);color:var(--accent);font-size:12px;overflow-wrap:anywhere}
    #jenkinsai-inspector .ai-actions{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:8px 18px 9px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}
    #jenkinsai-inspector .ai-refresh,#jenkinsai-inspector .ai-ask,#jenkinsai-inspector .ai-remember{border:1px solid var(--border);background:var(--bg);font:inherit;font-size:11.5px;font-weight:550;color:var(--muted);padding:5px 11px;border-radius:6px}
    #jenkinsai-inspector .ai-refresh:hover,#jenkinsai-inspector .ai-ask:hover,#jenkinsai-inspector .ai-remember:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
    #jenkinsai-inspector .ai-refresh{color:var(--accent)}
    #jenkinsai-inspector .ai-chat{display:flex;flex-direction:column;flex:1;min-height:0;background:var(--surface);padding:12px 18px 14px}
    #jenkinsai-inspector .ai-thread{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:9px;margin-bottom:12px;padding-right:3px}
    #jenkinsai-inspector .ai-msg{margin:0;font-size:12.5px;line-height:1.55;overflow-wrap:anywhere;padding:9px 13px;border-radius:10px}
    #jenkinsai-inspector .ai-msg[data-role=user]{background:var(--accent);color:#ffffff;margin-left:32px;border-bottom-right-radius:2px}
    #jenkinsai-inspector .ai-msg[data-role=model]{background:var(--bg);border:1px solid var(--border);color:var(--fg);border-bottom-left-radius:2px}
    #jenkinsai-inspector .ai-form{display:flex;gap:8px;align-items:flex-end;flex-shrink:0}
    #jenkinsai-inspector .ai-form textarea{flex:1;resize:none;min-height:42px;max-height:110px;border:1px solid var(--border);border-radius:8px;padding:9px 12px;background:var(--bg);color:var(--fg);font:12.5px/1.45 system-ui,sans-serif;outline:none}
    #jenkinsai-inspector .ai-form textarea:focus{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
    #jenkinsai-inspector .ai-form button{border:none;background:var(--accent);color:#fff;border-radius:8px;padding:0 16px;height:42px;font:600 12.5px system-ui,sans-serif;flex-shrink:0}
    #jenkinsai-inspector .ai-form button:hover{background:var(--accent-hover)}
    #jenkinsai-inspector .ai-launcher{display:flex;align-items:center;gap:8px;margin-left:auto;padding:8px 14px;border:1px solid var(--border);border-radius:24px;background:var(--bg);color:var(--fg);font:600 12.5px system-ui,sans-serif;box-shadow:0 8px 24px -4px rgba(0,0,0,0.35);cursor:pointer;transition:all .18s ease}
    #jenkinsai-inspector .ai-launcher:hover{background:var(--accent);border-color:var(--accent);color:#ffffff;transform:translateY(-2px);box-shadow:0 10px 28px -4px rgba(59,130,246,0.4)}
    #jenkinsai-inspector .ai-launcher svg{width:18px;height:18px;flex:none}
    @keyframes ai-slideup{from{opacity:0;transform:translateY(14px) scale(0.98)}to{opacity:1;transform:none}}
    #jenkinsai-inspector .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
    @media(prefers-reduced-motion:reduce){#jenkinsai-inspector *,#jenkinsai-inspector *:before{animation:none!important}}
  `;
  document.head.append(style);
  const root = document.createElement("div");
  root.id = "jenkinsai-inspector";
  root.dataset.verdict = "loading";
  root.innerHTML = `<section class="ai-popup" role="status" aria-live="polite"><div class="ai-head"><div class="ai-badge"><span class="ai-dot"></span><strong class="ai-badge-text">Diagnosing</strong></div><div class="ai-head-titles"><strong>Jenkins Console</strong><span class="ai-result"></span></div><button class="ai-close" type="button" aria-label="Close panel">×</button></div><div class="ai-body"><p class="ai-summary">JenkinsAI is reading this build.</p><p class="ai-evidence" hidden></p><p class="ai-next" hidden></p><p class="ai-memory" hidden></p></div><div class="ai-actions"><button class="ai-remember" type="button" hidden>Remember cause</button><button class="ai-ask" type="button" hidden>Hide chat</button><button class="ai-refresh" type="button">Re-inspect</button></div><div class="ai-chat"><div class="ai-thread" aria-live="polite"></div><form class="ai-form"><label class="sr-only" for="jenkinsai-question">Question about this build</label><textarea id="jenkinsai-question" rows="2" maxlength="12000" placeholder="Ask anything about this build failure or error logs..."></textarea><button type="submit">Send</button></form></div></section><button class="ai-launcher" type="button" aria-label="Show Jenkins AI Assistant" aria-expanded="true" title="Jenkins AI Assistant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v1H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3V5a3 3 0 0 0-3-3z"/><circle cx="9" cy="13" r="1.5"/><circle cx="15" cy="13" r="1.5"/><path d="M9 17h6"/></svg><span>JenkinsAI</span></button>`;
  document.body.append(root);
  const popup = root.querySelector(".ai-popup");
  const title = root.querySelector(".ai-head strong");
  const badgeText = root.querySelector(".ai-badge-text");
  const result = root.querySelector(".ai-result");
  const summary = root.querySelector(".ai-summary");
  const evidence = root.querySelector(".ai-evidence");
  const next = root.querySelector(".ai-next");
  const memoryNote = root.querySelector(".ai-memory");
  const bot = root.querySelector(".ai-launcher");
  const ask = root.querySelector(".ai-ask");
  const remember = root.querySelector(".ai-remember");
  const chat = root.querySelector(".ai-chat");
  const thread = root.querySelector(".ai-thread");
  const form = root.querySelector(".ai-form");
  const question = root.querySelector("#jenkinsai-question");
  const chatApi = new URL("../api/chat", source);
  const memoryApi = new URL("../api/memory", source);
  let history = [];
  let chatJob = jobs.join("/");
  let chatBuild = build;
  let remembered = false;
  let chatting = false;
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
  function showText(node, value, prefix) { node.textContent = value && value !== "None" ? `${prefix}${value}` : ""; node.hidden = !node.textContent; }
  async function errorMessage(response, action) {
    let detail = "";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch { /* Non-JSON proxy errors use the generic status message. */ }
    return detail || `${action} (${response.status}).`;
  }
  function openChatView() {
    popup.hidden = false;
    bot.setAttribute("aria-expanded", "true");
    chat.hidden = false;
    ask.textContent = "Hide chat";
    if (!thread.children.length) {
      addChat("model", "Ask about this build, or name another pipeline and build number. JenkinsAI answers build questions.");
    }
    setTimeout(() => question.focus(), 60);
  }
  bot.onclick = () => {
    if (popup.hidden) {
      openChatView();
    } else {
      popup.hidden = true;
      bot.setAttribute("aria-expanded", "false");
    }
  };
  root.querySelector(".ai-close").onclick = () => { popup.hidden = true; bot.setAttribute("aria-expanded", "false"); };
  root.querySelector(".ai-refresh").onclick = () => inspect();
  ask.onclick = () => {
    chat.hidden = !chat.hidden;
    ask.textContent = chat.hidden ? "Ask about this build" : "Hide chat";
    if (!chat.hidden) {
      if (!thread.children.length) addChat("model", "Ask about this build, or name another pipeline and build number. JenkinsAI answers build questions.");
      question.focus();
    }
  };
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
      root.dataset.verdict = data.verdict.toLowerCase();
      const catLabel = data.category === "APPLICATION"
        ? "App Code Issue"
        : (data.category === "DEVOPS" ? "DevOps / Infra Issue" : "");
      if (badgeText) badgeText.textContent = catLabel || data.verdict;
      title.textContent = ({CLEAN: "No issue found", ISSUE: "Issue detected", FAILED: "Build failed", UNCERTAIN: "Review needed"})[data.verdict] || "Review needed";
      result.textContent = `Build #${build} · ${catLabel ? `${catLabel} · ` : ""}${data.jenkins_result || "UNKNOWN"}`;
      summary.textContent = data.summary || "Review the console.";
      showText(evidence, data.evidence, "Evidence: ");
      showText(next, data.next, "Next: ");
      if (data.memory_match) {
        const saved = data.memory_match;
        remembered = true;
        memoryNote.textContent = `Seen before (${saved.source_job} #${saved.source_build}): ${saved.root_cause} Next: ${saved.next_step}`;
        memoryNote.hidden = false;
      } else if (remembered) {
        memoryNote.textContent = "Saved on the server for future matching errors. Raw logs were not saved.";
        memoryNote.hidden = false;
      }
      if (["ISSUE", "FAILED"].includes(data.verdict)) {
        remember.hidden = false;
        remember.textContent = data.memory_match || remembered ? "Already remembered" : "Remember cause";
        remember.disabled = Boolean(data.memory_match || remembered);
      }
      if (data.partial_log && data.verdict === "UNCERTAIN") showText(next, "Open the full log to confirm; this analysis used an excerpt.", "Next: ");
    } catch (error) {
      root.dataset.verdict = "error";
      if (badgeText) badgeText.textContent = "Error";
      title.textContent = "Analysis unavailable";
      const isModelError = /Gemma|API|token|quota|rephrase/i.test(error.message || "");
      summary.textContent = isModelError
        ? `${error.message}. You can retry or verify build logs in Jenkins.`
        : (error.message || "Could not complete analysis. Check connection and retry.");
      result.textContent = `Build #${build} · Unavailable`;
      ask.hidden = false;
      ask.textContent = "Ask manually";
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
