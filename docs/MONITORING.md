# Private Jenkins gateway and console inspector

The gateway serves Jenkins at `127.0.0.1:8090` and injects JenkinsAI's script into HTML. The script appears only when a signed-in user opens a build's Console Output page. It calls the authenticated `/assistant/api/inspect` endpoint for that build; the backend fetches read-only Jenkins metadata and a redacted log excerpt, then asks Gemma for a short verdict. A running build is rechecked every 15 seconds. A completed verdict is cached in memory.

Install the assistant using [the EC2 instructions](DEPLOYMENT.md), then configure the gateway:

```bash
bash deploy/install-widget-proxy.sh
```

For later gateway configuration changes, run `bash deploy/update-widget-proxy.sh`. Keep the gateway private and forward it over SSH:

```bash
ssh -L 8090:127.0.0.1:8090 ubuntu@YOUR_EC2_HOST
```

Open `http://127.0.0.1:8090/`, sign in to Jenkins, and visit **job → build → Console Output**. Port `8080` does not inject the popup. The browser does not receive the assistant token: Nginx checks the Jenkins session and adds that token server-side.

For console-only behavior, set `MONITOR_ENABLED=false` and `AUTO_ANALYZE_FAILURES=false` in `/etc/jenkinsai.env`, then restart `jenkinsai`. This disables background polling and automatic analysis of builds that nobody has opened. Opening a Console Output page still automatically sends that build's redacted excerpt to Gemma.

The reader account's permissions determine which builds the backend can inspect. The gateway checks that the browser is signed in, but it does not enforce each browser user's per-job permissions. Limit the reader account to trusted demo jobs. The AI verdict can be wrong; use the cited line to verify it.

## Recurring root-cause memory and build chat

After an `ISSUE` or `FAILED` diagnosis, **Remember this cause** asks for confirmation before saving. JenkinsAI stores a fingerprint derived from up to six normalized error lines, the redacted diagnosis and next step, and the source job/build. It does **not** store the raw console log. A later exact fingerprint match displays the earlier diagnosis and supplies it to Gemma as a hint; the current build's evidence remains authoritative. Similar-but-not-identical errors may not match.

In the popup chat, a user can ask about the open build or name another one, for example: `Check pipeline testing build #12`. Submitting that question sends the selected build's bounded, redacted console context to Gemma. Only builds visible to the configured Jenkins reader account can be checked.

On the systemd deployment, the database is `/var/lib/jenkinsai/memory.sqlite3`, owned by the `jenkinsai` service account and preserved across code updates. Set `MEMORY_DB_PATH` to move it. The memory is shared by users of this server and stays until an administrator removes it; do not use this shared-server design for untrusted users without per-user access controls.

If the popup reports **Analysis unavailable**, it displays the backend's safe error detail. For a Gemma API rejection, check `GEMINI_API_KEY`, `GEMMA_MODEL`, Google AI Studio model access/quota, and outbound HTTPS from the JenkinsAI host. For a Jenkins read failure, check the assistant service's `JENKINS_URL` and reader permissions for the selected job/build. On EC2, inspect `sudo journalctl -u jenkinsai -n 100 --no-pager`; do not paste API keys or tokens into chat or issue reports.
