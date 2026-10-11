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
    #jenkinsai-inspector{--bg:#fff;--fg:#1f2937;--muted:#64748b;--border:#dce3ec;--accent:#2875b9;--good:#168454;--bad:#b73545;position:fixed;right:16px;bottom:14px;z-index:2147483647;color:var(--fg);font:14px/1.4 system-ui,sans-serif}
    #jenkinsai-inspector[data-theme=dark]{--bg:#202c3b;--fg:#f1f5f9;--muted:#afc0d3;--border:#405166;--accent:#73c5ff;--good:#66d8a0;--bad:#ff8795}
    #jenkinsai-inspector *{box-sizing:border-box}
    #jenkinsai-inspector .ai-popup{width:min(340px,calc(100vw - 32px));margin:0 0 7px auto;background:var(--bg);border:1px solid var(--border);border-radius:14px;box-shadow:0 12px 38px #0003;overflow:hidden;animation:ai-appear .2s ease-out}
    #jenkinsai-inspector .ai-popup[hidden],#jenkinsai-inspector [hidden]{display:none!important}
    #jenkinsai-inspector .ai-head{display:flex;align-items:center;gap:8px;padding:12px 13px 7px}
    #jenkinsai-inspector .ai-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex:none}
    #jenkinsai-inspector[data-verdict=clean] .ai-dot{background:var(--good)}
    #jenkinsai-inspector[data-verdict=issue] .ai-dot,#jenkinsai-inspector[data-verdict=failed] .ai-dot,#jenkinsai-inspector[data-verdict=error] .ai-dot{background:var(--bad)}
    #jenkinsai-inspector .ai-head strong{font-size:14px;flex:1}
    #jenkinsai-inspector button{cursor:pointer}
    #jenkinsai-inspector .ai-close,#jenkinsai-inspector .ai-refresh{border:0;background:transparent;color:var(--muted);font:inherit}
    #jenkinsai-inspector .ai-close{font-size:20px;line-height:1;padding:0 2px}
    #jenkinsai-inspector .ai-body{padding:0 13px 10px}
    #jenkinsai-inspector .ai-result{font-size:12px;color:var(--muted);margin-bottom:7px}
    #jenkinsai-inspector .ai-summary{margin:0 0 8px;font-weight:600}
    #jenkinsai-inspector .ai-evidence,#jenkinsai-inspector .ai-next{margin:5px 0;color:var(--muted);font-size:12px;overflow-wrap:anywhere}
    #jenkinsai-inspector .ai-refresh{display:block;margin:0 12px 10px auto;font-size:12px;color:var(--accent)}
    #jenkinsai-inspector .ai-bot{display:block;margin-left:auto;width:65px;height:75px;padding:0;border:0;background:transparent;color:var(--accent);filter:drop-shadow(0 4px 4px #0003)}
    #jenkinsai-inspector .ai-bot svg{width:65px;height:75px;animation:ai-breathe 3s ease-in-out infinite}
    #jenkinsai-inspector .ai-face{fill:var(--bg)}
    #jenkinsai-inspector .ai-eyes{transform-origin:center;animation:ai-blink 5s infinite}
    #jenkinsai-inspector[data-verdict=loading] .ai-head-part{transform-origin:40px 35px;animation:ai-think 1s ease-in-out infinite}
    #jenkinsai-inspector[data-verdict=issue] .ai-bot,#jenkinsai-inspector[data-verdict=failed] .ai-bot{color:var(--bad)}
    #jenkinsai-inspector[data-verdict=issue] .ai-arm,#jenkinsai-inspector[data-verdict=failed] .ai-arm{transform-origin:57px 57px;animation:ai-wave .6s ease-in-out 4}
    @keyframes ai-appear{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes ai-breathe{50%{transform:translateY(-3px)}}@keyframes ai-blink{0%,45%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(.15)}}@keyframes ai-think{50%{transform:rotate(-8deg)}}@keyframes ai-wave{25%,75%{transform:rotate(-28deg)}50%{transform:rotate(17deg)}}
    @media(prefers-reduced-motion:reduce){#jenkinsai-inspector *,#jenkinsai-inspector *:before{animation:none!important}}
  `;
  document.head.append(style);
  const root = document.createElement("div");
  root.id = "jenkinsai-inspector";
  root.dataset.verdict = "loading";
  root.innerHTML = `<section class="ai-popup" role="status" aria-live="polite"><div class="ai-head"><span class="ai-dot"></span><strong>Checking console…</strong><button class="ai-close" type="button" aria-label="Close diagnosis">×</button></div><div class="ai-body"><div class="ai-result"></div><p class="ai-summary">JenkinsAI is reading this build.</p><p class="ai-evidence" hidden></p><p class="ai-next" hidden></p></div><button class="ai-refresh" type="button">Check again</button></section><button class="ai-bot" type="button" aria-label="Show JenkinsAI diagnosis" aria-expanded="true" title="JenkinsAI diagnosis"><svg viewBox="0 0 80 96" aria-hidden="true"><g stroke="currentColor" stroke-width="7" stroke-linecap="round"><path d="M32 72v14h-7M48 72v14h7"/><path d="M23 57 13 66 8 60"/><path class="ai-arm" d="M57 57 67 47 70 38"/></g><rect x="23" y="48" width="34" height="31" rx="12" fill="currentColor"/><rect x="31" y="55" width="18" height="13" rx="6" class="ai-face"/><g class="ai-head-part"><path d="M40 15V8m0 0h4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="15" y="15" width="50" height="37" rx="14" fill="currentColor"/><rect x="20" y="20" width="40" height="27" rx="10" class="ai-face"/><g class="ai-eyes" fill="currentColor"><circle cx="32" cy="32" r="3"/><circle cx="48" cy="32" r="3"/></g><path d="M34 40q6 4 12 0" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></g></svg></button>`;
  document.body.append(root);
  const popup = root.querySelector(".ai-popup");
  const title = root.querySelector(".ai-head strong");
  const result = root.querySelector(".ai-result");
  const summary = root.querySelector(".ai-summary");
  const evidence = root.querySelector(".ai-evidence");
  const next = root.querySelector(".ai-next");
  const bot = root.querySelector(".ai-bot");
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
  bot.onclick = () => { popup.hidden = !popup.hidden; bot.setAttribute("aria-expanded", String(!popup.hidden)); };
  root.querySelector(".ai-close").onclick = () => { popup.hidden = true; bot.setAttribute("aria-expanded", "false"); };
  root.querySelector(".ai-refresh").onclick = () => inspect();
  let timer;
  async function inspect() {
    clearTimeout(timer);
    root.dataset.verdict = "loading";
    title.textContent = "Checking console…";
    result.textContent = `Build #${build}`;
    summary.textContent = "JenkinsAI is reading this build.";
    evidence.hidden = next.hidden = true;
    try {
      const response = await fetch(api, {method: "POST", credentials: "same-origin", headers: {"Content-Type": "application/json"}, body: JSON.stringify({job: jobs.join("/"), build})});
      if (!response.ok) throw new Error(response.status === 429 ? "Analysis busy. Try again shortly." : `Could not analyze build (${response.status}).`);
      const data = await response.json();
      if (data.status === "running") {
        title.textContent = "Pipeline running";
        summary.textContent = "I’ll check the console when this run finishes.";
        timer = setTimeout(inspect, 15000);
        return;
      }
      root.dataset.verdict = data.verdict.toLowerCase();
      title.textContent = ({CLEAN: "No issue found", ISSUE: "Issue found", FAILED: "Build failed", UNCERTAIN: "Review needed"})[data.verdict] || "Review needed";
      result.textContent = `Jenkins: ${data.jenkins_result || "UNKNOWN"}${data.verdict === "ISSUE" && data.jenkins_result === "SUCCESS" ? " · Hidden issue" : ""}`;
      summary.textContent = data.summary || "Review the console.";
      showText(evidence, data.evidence, "Evidence: ");
      showText(next, data.next, "Next: ");
      if (data.partial_log && data.verdict === "UNCERTAIN") showText(next, "Open the full log to confirm; this analysis used an excerpt.", "Next: ");
    } catch (error) {
      root.dataset.verdict = "error";
      title.textContent = "Analysis unavailable";
      summary.textContent = error.message || "Try again.";
      result.textContent = `Build #${build}`;
    }
  }
  inspect();
})();
