/* Optional browser-loaded widget. Serve this script from your assistant origin.
 * No Jenkins credentials, API keys, or assistant token belong in this file.
 * For a local demo, use the bookmarklet described in docs/JENKINS-WIDGET.md.
 */
(() => {
  "use strict";
  if (document.getElementById("jenkinsai-widget-frame")) return;
  const src = document.currentScript?.src;
  if (!src) return;
  const base = new URL("../", src);
  const button = document.createElement("button");
  button.setAttribute("aria-label", "Open JenkinsAI");
  button.title = "Open JenkinsAI";
  button.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:2147483647;background:#9fe3cc;color:#101722;border:0;border-radius:50%;width:56px;height:56px;padding:0;font:28px system-ui;cursor:pointer;display:grid;place-items:center;box-shadow:0 4px 16px #0004";
  const icon = document.createElement("span");
  icon.textContent = "🤖";
  const badge = document.createElement("span");
  badge.hidden = true;
  badge.style.cssText = "position:absolute;top:-5px;right:-5px;min-width:20px;height:20px;padding:2px 5px;border-radius:10px;background:#e64b5d;color:white;font:700 11px system-ui";
  button.append(icon, badge);
  const frame = document.createElement("iframe");
  frame.id = "jenkinsai-widget-frame"; frame.title = "JenkinsAI read-only assistant";
  frame.src = new URL("?widget=1", base).href; frame.hidden = true;
  frame.style.cssText = "position:fixed;right:24px;bottom:80px;z-index:2147483647;width:min(415px,calc(100vw - 32px));height:min(760px,calc(100dvh - 110px));border:0;border-radius:12px";
  button.setAttribute("aria-expanded", "false");
  let unread = 0;
  window.addEventListener("message", event => {
    if (event.source !== frame.contentWindow || event.origin !== base.origin || event.data?.type !== "jenkinsai-build-event") return;
    if (frame.hidden) {
      unread += 1;
      badge.textContent = unread > 9 ? "9+" : String(unread);
      badge.hidden = false;
      button.setAttribute("aria-label", `Open JenkinsAI, ${unread} updates`);
    }
  });
  button.onclick = () => { frame.hidden = !frame.hidden; if (!frame.hidden) { unread = 0; badge.hidden = true; } icon.textContent = frame.hidden ? "🤖" : "✕"; button.setAttribute("aria-label", frame.hidden ? "Open JenkinsAI" : "Close JenkinsAI"); button.title = frame.hidden ? "Open JenkinsAI" : "Close JenkinsAI"; button.setAttribute("aria-expanded", String(!frame.hidden)); };
  document.body.append(frame, button);
})();
