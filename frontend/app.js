"use strict";
const el = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const embedded = params.get("widget") === "1";
const gateway = location.pathname.startsWith("/assistant/");
if (embedded) document.body.classList.add("widget");
if (gateway) document.querySelector(".connection").hidden = true;
let history = [], folder = "", selectedJob = "", jobEntries = [], previewed = false, busy = false, connected = false;
let monitorTimer = null, monitorCursor = 0;
let monitorInstance = null;
let monitorGeneration = 0;
const apiBase = new URL("./", location.href);
function readPageContext() {
  let path = location.pathname;
  try { if (embedded && window.parent !== window && window.parent.location.origin === location.origin) path = window.parent.location.pathname; } catch { /* Standalone iframe: no Jenkins page context. */ }
  const parts = path.split("/").filter(Boolean).map(part => { try { return decodeURIComponent(part); } catch { return part; } });
  const jobs = [];
  let lastJob = -1;
  for (let i = 0; i < parts.length - 1; i++) if (parts[i] === "job") { jobs.push(parts[i + 1]); lastJob = i + 1; i++; }
  const build = lastJob >= 0 && /^\d+$/.test(parts[lastJob + 1] || "") ? Number(parts[lastJob + 1]) : null;
  return {job: jobs.join("/"), build};
}
let pageContext = readPageContext();
function pageLabel() { return pageContext.job ? `${pageContext.job}${pageContext.build ? ` #${pageContext.build}` : ""}` : "Open a Jenkins job"; }
const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme(theme) { document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light"; }
applyTheme(params.get("theme") || (preferredTheme.matches ? "dark" : "light"));
preferredTheme.addEventListener("change", () => { if (!embedded) applyTheme(preferredTheme.matches ? "dark" : "light"); });
window.addEventListener("message", event => {
  if (embedded && event.source === window.parent && event.origin === location.origin && event.data?.type === "jenkinsai-theme") applyTheme(event.data.theme);
});
function botState(state) {
  document.querySelector(".avatar").dataset.state = state;
  if (embedded && window.parent !== window) window.parent.postMessage({type: "jenkinsai-widget-state", state}, apiBase.origin);
}
function openAssistant() {
  el("assistant").hidden = false; el("launcher").hidden = true;
  el("launcher").setAttribute("aria-expanded", "true"); el("question").focus();
}
function configureWidget() {
  try {
    const url = new URL(el("assistant-url").value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Use an HTTP(S) assistant URL without credentials, query, or fragment.");
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.search = "?widget=1";
    const code = `(()=>{if(document.getElementById('jenkinsai-widget-frame'))return;const f=document.createElement('iframe');f.id='jenkinsai-widget-frame';f.title='JenkinsAI assistant';f.src=${JSON.stringify(url.href)};f.style.cssText='position:fixed;right:16px;bottom:76px;width:min(415px,calc(100vw - 32px));height:min(760px,calc(100vh - 100px));border:0;border-radius:12px;z-index:2147483647';const b=document.createElement('button');b.textContent='Close JenkinsAI';b.setAttribute('aria-expanded','true');b.style.cssText='position:fixed;right:16px;bottom:20px;padding:14px 20px;border:0;border-radius:24px;background:#9fe3cc;color:#101722;font:600 14px system-ui;cursor:pointer;z-index:2147483647';b.onclick=()=>{f.hidden=!f.hidden;b.textContent=f.hidden?'Open JenkinsAI':'Close JenkinsAI';b.setAttribute('aria-expanded',String(!f.hidden))};document.body.append(f,b)})();`;
    el("widget-bookmark").href = "javascript:" + code;
    el("widget-preview").href = url.href;
    el("copy-widget").disabled = false;
    el("setup-status").textContent = "Drag Open JenkinsAI to your bookmarks bar for a temporary launcher. The URL contains no tokens or API keys.";
    return el("widget-bookmark").getAttribute("href");
  } catch (error) {
    el("widget-bookmark").removeAttribute("href"); el("widget-preview").removeAttribute("href");
    el("copy-widget").disabled = true; el("setup-status").textContent = error.message;
    return null;
  }
}
el("assistant-url").value = apiBase.href;
el("assistant-url").oninput = configureWidget;
el("widget-bookmark").onclick = event => { event.preventDefault(); el("setup-status").textContent = "Drag this link to your bookmarks bar, or copy its URL into a new bookmark. Click that bookmark while Jenkins is open."; };
el("copy-widget").onclick = async () => {
  const bookmark = configureWidget(); if (!bookmark) return;
  try { await navigator.clipboard.writeText(bookmark); el("setup-status").textContent = "Copied. Paste into a bookmark's URL, then click the bookmark on Jenkins."; }
  catch { el("setup-status").textContent = "Clipboard unavailable here. Drag Open JenkinsAI to your bookmarks bar instead."; }
};
el("open-assistant").onclick = openAssistant;
configureWidget();
function status(text) { el("status").textContent = text; }
async function watchBuilds(generation = monitorGeneration) {
  if (!connected || generation !== monitorGeneration) return;
  try {
    const latestPage = readPageContext();
    if (latestPage.job !== pageContext.job || latestPage.build !== pageContext.build) {
      pageContext = latestPage; history = []; el("messages").replaceChildren(); el("monitor-events").replaceChildren();
      addMessage("model", pageContext.job ? `Following ${pageLabel()}. Ask me about this page.` : "Open a Jenkins job or build to see its updates here.");
      el("mode").textContent = `Online · ${pageLabel()}`;
      await loadJobs();
    }
    const data = await api("api/monitor?after=" + monitorCursor);
    if (generation !== monitorGeneration) return;
    // Server restart resets its bounded event cursor.
    if (monitorInstance && monitorInstance !== data.instance) {
      monitorCursor = 0; monitorInstance = data.instance;
      el("monitor-events").replaceChildren();
      return;
    }
    monitorInstance = data.instance;
    el("monitor-badge").textContent = embedded && !pageContext.job ? "NO JOB" : !data.enabled ? "OFF" : data.error ? "RETRYING" : data.last_poll ? "WATCHING" : "STARTING";
    el("monitor-status").textContent = data.error || (embedded ? !pageContext.job ? "Open a Jenkins job to follow its builds." : `Showing only ${pageLabel()}. ${data.auto_analyze ? "Failed builds get AI summaries." : "Build alerts are on."}` : `${data.job_count} jobs · checks every ${data.interval}s.`);
    for (const item of data.events) {
      if (embedded && (!pageContext.job || item.job !== pageContext.job || (pageContext.build && item.build !== pageContext.build))) continue;
      const event = document.createElement("details"); event.className = "monitor-event";
      event.dataset.result = item.result;
      const title = document.createElement("summary");
      title.textContent = `${item.job} #${item.build} · ${item.kind === "analysis" ? "AI diagnosis" : item.kind === "analysis_error" ? "Analysis unavailable" : item.result}`;
      const content = document.createElement("p"); content.textContent = item.text;
      event.append(title, content); el("monitor-events").prepend(event);
      if (item.kind === "analysis") { addMessage("model", `${item.job} #${item.build} · Automatic diagnosis\n\n${item.text}`); botState("hello"); }
      if (item.kind === "analysis_error") botState("error");
      if (embedded && window.parent !== window) {
        // Parent validates source and origin; only a notification label is shared.
        window.parent.postMessage({type: "jenkinsai-build-event", result: item.result, diagnosis: item.kind === "analysis"}, apiBase.origin);
      }
    }
    while (el("monitor-events").children.length > 30) el("monitor-events").lastChild.remove();
    monitorCursor = data.cursor;
  } catch (error) { el("monitor-badge").textContent = "RETRYING"; el("monitor-status").textContent = error.message; }
  finally { if (connected && generation === monitorGeneration) monitorTimer = setTimeout(() => watchBuilds(generation), 5000); }
}
async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (el("token").value) headers.Authorization = "Bearer " + el("token").value;
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(new URL(path, apiBase), { ...options, headers, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request invalid; clear the chat and retry.");
  return data;
}
function addMessage(role, text) {
  const node = document.createElement("div"); node.className = "message " + role;
  const author = document.createElement("span"); author.className = "author"; author.textContent = role === "user" ? "YOU" : "JENKINSAI";
  const body = document.createElement("p");
  const cleaned = role === "model" ? text.replace(/^\s{0,3}#{1,6}\s*/gm, "").replace(/\*\*/g, "").replace(/\n{3,}/g, "\n\n").trim() : text;
  if (role === "model" && cleaned.length > 520) {
    const cut = cleaned.lastIndexOf(" ", 520);
    body.textContent = cleaned.slice(0, cut > 360 ? cut : 520).trimEnd() + "…";
    const more = document.createElement("button"); more.className = "message-more"; more.textContent = "Read more";
    more.onclick = () => { const expanded = more.textContent === "Read less"; body.textContent = expanded ? cleaned.slice(0, cut > 360 ? cut : 520).trimEnd() + "…" : cleaned; more.textContent = expanded ? "Read more" : "Read less"; };
    node.append(author, body, more);
  } else { body.textContent = cleaned; node.append(author, body); }
  el("messages").append(node); el("messages").scrollTop = el("messages").scrollHeight;
  while (el("messages").children.length > 80) el("messages").firstChild.remove();
}
function option(select, value, text) { const o = document.createElement("option"); o.value = value; o.textContent = text; select.append(o); }
function resetPreview() {
  previewed = false; el("consent").checked = false; el("consent").disabled = true;
  el("preview-panel").open = false; el("log-preview").textContent = "Preview this build before enabling log sharing."; el("log-info").textContent = "";
}
function setBusy(value) {
  busy = value;
  botState(value ? "thinking" : "idle");
  for (const id of ["send", "clear", "diagnose", "general", "refresh", "up", "connect", "consent"]) el(id).disabled = value;
  el("jobs").disabled = value || embedded;
  el("builds").disabled = value || !selectedJob || (embedded && !!pageContext.build) || el("builds").options.length < 2;
  el("preview").disabled = value || !el("builds").value;
  el("consent").disabled = value || !previewed;
}
async function loadJobs() {
  const root = await api("api/jobs?folder=" + encodeURIComponent(folder));
  if (!embedded && !pageContext.job) {
    jobEntries = root.jobs; el("jobs").replaceChildren(); option(el("jobs"), "", folder ? folder + " / …" : "Select job or folder");
    root.jobs.forEach((job, index) => option(el("jobs"), String(index), (job.folder ? "Folder · " : "") + job.name));
    el("up").hidden = !folder; selectedJob = "";
    el("builds").replaceChildren(); option(el("builds"), "", "Select failed build"); el("builds").disabled = true; el("preview").disabled = true; resetPreview();
    return;
  }
  jobEntries = []; el("jobs").replaceChildren(); el("up").hidden = true;
  el("builds").replaceChildren(); el("builds").disabled = true; el("preview").disabled = true; resetPreview();
  selectedJob = pageContext.job;
  if (!selectedJob) {
    option(el("jobs"), "", "Open a Jenkins job first"); el("jobs").disabled = true;
    option(el("builds"), "", "No build selected"); return;
  }
  jobEntries = [{name: selectedJob.split("/").at(-1), path: selectedJob, folder: false}];
  option(el("jobs"), "0", selectedJob); el("jobs").disabled = true;
  const data = await api("api/builds?job=" + encodeURIComponent(selectedJob));
  option(el("builds"), "", pageContext.build ? "Current build" : "Select failed build");
  if (pageContext.build) {
    option(el("builds"), String(pageContext.build), `#${pageContext.build} · Current page`);
    el("builds").value = String(pageContext.build); el("builds").disabled = true; el("preview").disabled = false;
  } else {
    data.builds.forEach(b => option(el("builds"), String(b.number), "#" + b.number + " · " + b.result));
    el("builds").disabled = !data.builds.length;
  }
}
async function connect() {
  clearTimeout(monitorTimer);
  monitorGeneration += 1;
  connected = false;
  try {
    botState("thinking"); status("Connecting…"); const health = await api("health");
    el("mode").textContent = health.demo ? "Demo · read-only" : `Online · ${pageLabel()}`;
    document.querySelector(".connection").hidden = health.demo || gateway;
    await loadJobs(); connected = true;
    document.querySelector(".connection").open = false;
    el("connection-state").textContent = health.demo ? "Offline demo ready · sample data" : "Connected to Jenkins · live mode";
    el("connection-state").dataset.state = health.demo ? "demo" : "live";
    status(""); botState("hello");
    watchBuilds();
  } catch (error) { connected = false; el("connection-state").textContent = "Connection required · open assistant"; el("connection-state").dataset.state = "error"; status(error.message); botState("error"); }
}
el("connect").onclick = connect;
el("refresh").onclick = async () => { if (busy) return; try { await loadJobs(); status("Jobs refreshed."); } catch (e) { status(e.message); } };
el("up").onclick = async () => { if (busy) return; folder = folder.split("/").slice(0, -1).join("/"); try { await loadJobs(); } catch (e) { status(e.message); } };
el("jobs").onchange = async () => {
  if (busy) return;
  const job = jobEntries[Number(el("jobs").value)]; resetPreview();
  if (el("jobs").value === "" || !job) { selectedJob = ""; el("builds").disabled = true; el("preview").disabled = true; return; }
  try {
    if (job.folder) { folder = job.path; await loadJobs(); return; }
    selectedJob = job.path; el("builds").disabled = true; el("preview").disabled = true;
    el("builds").replaceChildren(); option(el("builds"), "", "Loading builds…");
    const data = await api("api/builds?job=" + encodeURIComponent(job.path));
    el("builds").replaceChildren(); option(el("builds"), "", data.builds.length ? "Select failed build" : "No failures in last 30 builds");
    data.builds.forEach(b => option(el("builds"), String(b.number), "#" + b.number + " · " + b.result)); el("builds").disabled = false;
  } catch (e) { status(e.message); }
};
el("builds").onchange = () => { resetPreview(); el("preview").disabled = !el("builds").value; };
el("preview").onclick = async () => {
  if (busy) return;
  try {
    setBusy(true); status("Fetching read-only build evidence…");
    const data = await api("api/context?job=" + encodeURIComponent(selectedJob) + "&build=" + el("builds").value);
    el("log-preview").textContent = data.log; el("evidence").textContent = data.log;
    el("evidence-badge").textContent = data.job + " #" + data.build + " · " + data.result;
    el("log-info").textContent = `${data.source_lines} retrieved lines. ${data.excerpted ? "Excerpt selected. " : ""}${data.download_truncated ? "Download capped at 2 MB; later lines unavailable. " : ""}Redaction is best-effort; review for secrets.`;
    previewed = true; el("preview-panel").open = true; status("Preview stays in your browser. Check for secrets before sharing.");
  } catch (e) { status(e.message); } finally { setBusy(false); }
};
el("diagnose").onclick = () => { el("question").value = `Explain ${pageLabel()} briefly: cause, evidence, fix, verify.`; el("question").focus(); status(el("consent").checked ? "Ready with build evidence." : "Open Analyze a build to include its logs."); };
el("general").onclick = () => { el("question").value = "How can I improve a Jenkins declarative pipeline for reliability and secure secret handling?"; el("question").focus(); };
el("composer").onsubmit = async event => {
  event.preventDefault(); const question = el("question").value.trim(); if (!question || busy) return;
  if (!connected) { status("Connect with your assistant token first."); return; }
  // Keep at most eight pairs, beginning with a user; backend enforces a second bound.
  const candidate = [...history.slice(-16), { role: "user", content: question }];
  const payload = { messages: candidate };
  if (el("consent").checked && previewed && selectedJob && el("builds").value) Object.assign(payload, { job: selectedJob, build: Number(el("builds").value), share_logs: true });
  addMessage("user", question); el("question").value = ""; setBusy(true); status("Analyzing…");
  let failed = false;
  try {
    const data = await api("api/chat", { method: "POST", body: JSON.stringify(payload) });
    history = [...candidate, { role: "model", content: data.answer.slice(0, 12000) }]; addMessage("model", data.answer); status(data.demo ? "Offline demo response. Enable live mode for Gemma." : "Response from " + data.model + ". Review before acting.");
  } catch (e) { failed = true; status(e.message); el("question").value = question; } finally { setBusy(false); botState(failed ? "error" : "hello"); el("question").focus(); }
};
el("question").onkeydown = event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); el("composer").requestSubmit(); } };
el("clear").onclick = () => { history = []; el("messages").replaceChildren(); addMessage("model", pageContext.job ? `Following ${pageLabel()}. Ask me a question.` : embedded ? "Open a Jenkins job or build to see its updates here." : "Select a job or ask me a question."); el("consent").checked = false; status(""); };
el("close").onclick = () => { el("assistant").hidden = true; el("launcher").hidden = false; el("launcher").setAttribute("aria-expanded", "false"); el("launcher").focus(); };
el("launcher").onclick = openAssistant;
el("launcher").hidden = true; resetPreview();
addMessage("model", pageContext.job ? `Hi! Following ${pageLabel()}. Ask about this page, or open Analyze a build to share logs.` : embedded ? "Hi! Open a Jenkins job or build to see its updates here." : "Hi! Select a job or ask me a question.");
botState("hello");
connect();
