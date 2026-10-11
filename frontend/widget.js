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
  button.textContent = "Ask JenkinsAI";
  button.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:2147483647;background:#9fe3cc;color:#101722;border:0;border-radius:24px;padding:14px 20px;font:600 14px system-ui;cursor:pointer";
  const frame = document.createElement("iframe");
  frame.id = "jenkinsai-widget-frame"; frame.title = "JenkinsAI read-only assistant";
  frame.src = new URL("?widget=1", base).href; frame.hidden = true;
  frame.style.cssText = "position:fixed;right:24px;bottom:80px;z-index:2147483647;width:min(415px,calc(100vw - 32px));height:min(760px,calc(100dvh - 110px));border:0;border-radius:12px";
  button.setAttribute("aria-expanded", "false");
  button.onclick = () => { frame.hidden = !frame.hidden; button.textContent = frame.hidden ? "Ask JenkinsAI" : "Close assistant"; button.setAttribute("aria-expanded", String(!frame.hidden)); };
  document.body.append(frame, button);
})();
