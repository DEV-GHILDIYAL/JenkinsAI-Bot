/* Bottom-right JenkinsAI widget. Credentials stay inside the assistant iframe. */
(() => {
  "use strict";
  if (document.getElementById("jenkinsai-widget-frame")) return;
  const src = document.currentScript?.src;
  if (!src) return;
  const base = new URL("../", src);

  const style = document.createElement("style");
  style.textContent = `
    #jenkinsai-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483647;width:56px;height:56px;padding:0;display:grid;place-items:center;border:1px solid #d7e1e9;border-radius:50%;background:#fff;color:#2869a3;box-shadow:0 5px 18px #0002;cursor:pointer}
    #jenkinsai-launcher[data-theme=dark]{background:#263340;color:#9ad2ff;border-color:#46586a}
    #jenkinsai-launcher svg{width:39px;height:39px;animation:jenkinsai-breathe 3s ease-in-out infinite}
    #jenkinsai-launcher .bot-eyes{transform-origin:center;animation:jenkinsai-blink 5s infinite}
    #jenkinsai-launcher[data-state=hello] .bot-antenna{transform-origin:24px 10px;animation:jenkinsai-wave .55s ease-in-out 3}
    #jenkinsai-launcher[data-state=thinking] svg{animation:jenkinsai-think 1s ease-in-out infinite}
    #jenkinsai-launcher[data-state=error] svg{animation:jenkinsai-error .35s ease-in-out 2}
    #jenkinsai-unread{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;padding:2px 5px;border-radius:10px;background:#c23a4d;color:white;font:700 11px system-ui}
    #jenkinsai-unread[hidden],#jenkinsai-speech[hidden],#jenkinsai-widget-frame[hidden]{display:none!important}
    #jenkinsai-speech{position:absolute;right:66px;top:12px;white-space:nowrap;padding:7px 10px;border-radius:10px;background:#fff;color:#243447;border:1px solid #d7e1e9;box-shadow:0 3px 12px #0002;font:600 12px system-ui}
    #jenkinsai-launcher[data-theme=dark] #jenkinsai-speech{background:#263340;color:#edf1f6;border-color:#46586a}
    #jenkinsai-widget-frame{position:fixed;right:20px;bottom:84px;z-index:2147483647;width:min(390px,calc(100vw - 28px));height:min(640px,calc(100dvh - 105px));border:0;border-radius:14px;box-shadow:0 12px 42px #0003}
    @keyframes jenkinsai-breathe{50%{transform:translateY(-2px)}}@keyframes jenkinsai-blink{0%,45%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(.15)}}@keyframes jenkinsai-wave{50%{transform:rotate(20deg)}}@keyframes jenkinsai-think{50%{transform:rotate(-7deg) translateY(-2px)}}@keyframes jenkinsai-error{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
    @media(prefers-reduced-motion:reduce){#jenkinsai-launcher svg,#jenkinsai-launcher .bot-eyes,#jenkinsai-launcher .bot-antenna{animation:none!important}}
  `;
  document.head.append(style);

  const button = document.createElement("button");
  button.id = "jenkinsai-launcher";
  button.type = "button";
  button.title = "Open JenkinsAI";
  button.setAttribute("aria-label", "Open JenkinsAI");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="bot-antenna" d="M24 10V5m0 0h4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><rect x="6" y="10" width="36" height="30" rx="11" fill="currentColor"/><rect x="10" y="14" width="28" height="20" rx="8" fill="var(--jenkinsai-face)"/><g class="bot-eyes" fill="currentColor"><circle cx="18" cy="23" r="2.4"/><circle cx="30" cy="23" r="2.4"/></g><path d="M20 29q4 3 8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  button.style.setProperty("--jenkinsai-face", "#fff");
  const badge = document.createElement("span"); badge.id = "jenkinsai-unread"; badge.hidden = true;
  const speech = document.createElement("span"); speech.id = "jenkinsai-speech"; speech.hidden = true;
  button.append(badge, speech);

  const frame = document.createElement("iframe");
  frame.id = "jenkinsai-widget-frame";
  frame.title = "JenkinsAI read-only assistant";
  frame.hidden = true;
  let theme = "";
  function pageTheme() {
    const marker = `${document.documentElement.dataset.theme || ""} ${document.documentElement.className || ""} ${document.body?.className || ""}`.toLowerCase();
    if (/\bdark\b/.test(marker)) return "dark";
    if (/\blight\b/.test(marker)) return "light";
    for (const selector of ["#main-panel", "#page-body", "main", "body", "html"]) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const parts = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number);
      if (parts?.length >= 3 && (parts.length < 4 || parts[3] > 0)) {
        const brightness = (parts[0] * 299 + parts[1] * 587 + parts[2] * 114) / 1000;
        return brightness < 130 ? "dark" : "light";
      }
    }
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function syncTheme() {
    const next = pageTheme();
    if (next === theme) return;
    theme = next;
    button.dataset.theme = theme;
    button.style.setProperty("--jenkinsai-face", theme === "dark" ? "#263340" : "#fff");
    frame.contentWindow?.postMessage({type: "jenkinsai-theme", theme}, base.origin);
  }
  theme = pageTheme();
  button.dataset.theme = theme;
  button.style.setProperty("--jenkinsai-face", theme === "dark" ? "#263340" : "#fff");
  frame.src = new URL(`?widget=1&theme=${theme}`, base).href;
  frame.addEventListener("load", () => frame.contentWindow?.postMessage({type: "jenkinsai-theme", theme}, base.origin));
  new MutationObserver(syncTheme).observe(document.documentElement, {attributes: true, attributeFilter: ["class", "style", "data-theme"]});
  if (document.body) new MutationObserver(syncTheme).observe(document.body, {attributes: true, attributeFilter: ["class", "style", "data-theme"]});
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTheme);

  let stateTimer, unread = 0;
  function setState(state) {
    if (!["hello", "thinking", "error", "idle"].includes(state)) return;
    clearTimeout(stateTimer);
    button.dataset.state = state;
    const label = {hello: "Hi!", thinking: "Thinking…", error: "Oops, try again", idle: ""}[state];
    speech.textContent = label;
    speech.hidden = !label || !frame.hidden;
    if (state === "hello" || state === "error") stateTimer = setTimeout(() => setState("idle"), 3600);
  }
  window.addEventListener("message", event => {
    if (event.source !== frame.contentWindow || event.origin !== base.origin) return;
    if (event.data?.type === "jenkinsai-widget-state") setState(event.data.state);
    if (event.data?.type === "jenkinsai-build-event" && frame.hidden) {
      unread += 1;
      badge.textContent = unread > 9 ? "9+" : String(unread);
      badge.hidden = false;
      button.setAttribute("aria-label", `Open JenkinsAI, ${unread} updates`);
      setState(event.data.result === "FAILURE" ? "error" : "hello");
    }
  });
  button.onclick = () => {
    frame.hidden = !frame.hidden;
    speech.hidden = true;
    if (!frame.hidden) { unread = 0; badge.hidden = true; }
    const label = frame.hidden ? "Open JenkinsAI" : "Close JenkinsAI";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-expanded", String(!frame.hidden));
  };
  document.body.append(frame, button);
  setState("hello");
})();
