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
