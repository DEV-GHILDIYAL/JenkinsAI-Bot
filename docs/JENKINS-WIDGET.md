# Bottom-right Jenkins widget

For the fastest demo, run the assistant privately via SSH forwarding and use the following bookmarklet on your Jenkins dashboard. Create a browser bookmark, edit its URL to this single line, then click it while Jenkins is open at `http://127.0.0.1:8080`:

```javascript
javascript:(()=>{if(document.getElementById('jenkinsai-demo'))return;const f=document.createElement('iframe');f.id='jenkinsai-demo';f.title='JenkinsAI read-only assistant';f.src='http://127.0.0.1:8000/?widget=1';f.style.cssText='position:fixed;right:24px;bottom:76px;width:min(415px,calc(100vw - 32px));height:min(760px,calc(100vh - 100px));border:0;border-radius:12px;z-index:2147483647';const b=document.createElement('button');b.textContent='Close JenkinsAI';b.style.cssText='position:fixed;right:24px;bottom:24px;padding:12px 18px;z-index:2147483647';b.onclick=()=>{f.hidden=!f.hidden;b.textContent=f.hidden?'Open JenkinsAI':'Close JenkinsAI'};document.body.append(f,b)})();
```

This only changes the current browser page. Reloading removes the widget. No Jenkins configuration, jobs, builds, credentials, or plugins are altered. Enter the assistant token inside the iframe in live mode. Do not place any token in the bookmarklet.

The assistant allows framing only from itself and the exact `JENKINS_FRAME_ORIGIN`. Jenkins's own Content Security Policy may also block frames, bookmarklets, or external scripts. If blocked, open the standalone assistant; do not disable Jenkins security globally. HTTPS Jenkins pages cannot embed an HTTP assistant; use an HTTPS assistant/reverse proxy with compatible policy.

For an administrator-approved persistent dashboard customization, `frontend/widget.js` creates the same bottom-right launcher and iframe. Load it with an external `<script src="https://YOUR_ASSISTANT/static/widget.js"></script>` only through an approved Jenkins customization mechanism and CSP. A Jenkins Java plugin is outside this MVP; this file does not install one.

The iframe isolates credentials/UI from Jenkins page scripts. The backend still uses the configured reader identity rather than the current Jenkins user's permissions. Sharing an assistant token grants access to all jobs visible to that reader.
