# Persistent Jenkins bot and automatic monitoring

The backend watches Jenkins while the assistant systemd service is running, even with no browser open. It polls every 15 seconds by default, traverses folders/multibranch jobs visible to the reader, and records running and completed build transitions. Success gets a status update; FAILURE, UNSTABLE and ABORTED can get Gemma diagnoses. Concurrent builds and short builds completed between polls are included in the most recent 30 builds per job.

## Enable the service

From the EC2 checkout:

```bash
git pull --ff-only
bash deploy/update.sh
sudoedit /etc/jenkinsai.env
```

Use `bash deploy/install.sh` instead of `update.sh` for a first installation. Configure the existing Gemini key, Jenkins reader identity/token and assistant token as described in README. Add:

```dotenv
DEMO_MODE=false
MONITOR_ENABLED=true
MONITOR_INTERVAL_SECONDS=15
AUTO_ANALYZE_FAILURES=true
JENKINS_URL=http://127.0.0.1:8080
JENKINS_FRAME_ORIGIN=http://127.0.0.1:8090
```

**Setting AUTO_ANALYZE_FAILURES=true authorizes automatic transmission of new failed builds' redacted log excerpts to Google.** There is no per-build preview/consent in this mode. Restrict the reader to permitted demo jobs and review the logs first; redaction is best-effort. Default is false: status events work, while AI analysis is manual. General chat and manual analysis keep their existing behavior.

```bash
sudo systemctl restart jenkinsai
curl --fail http://127.0.0.1:8000/health
```

## Keep the widget on every Jenkins page

The provided private Nginx gateway serves the same Jenkins UI and inserts `/assistant/static/widget.js` into HTML responses on every page load. It proxies the assistant at `/assistant/` on the same origin, preserving frontend/API relative paths. Jenkins remains on its original port 8080. The widget appears automatically through the gateway at 8090, **not** when browsing Jenkins directly at 8080. This is a reverse-proxy integration, not a Jenkins Java plugin.

Install Nginx if needed and review its default listeners. The widget script itself only adds a listener on 127.0.0.1:8090 and refuses to overwrite an existing config:

```bash
sudo apt-get update
sudo apt-get install -y nginx
bash deploy/install-widget-proxy.sh
```

From your laptop (adjust the key path):

```bash
ssh -o ExitOnForwardFailure=yes -i ~/JenkinsAI-Server-Key.pem \
  -L 8090:127.0.0.1:8090 ubuntu@3.110.55.60
```

Keep that terminal open. Open **http://127.0.0.1:8090/** for Jenkins; the bottom-right JenkinsAI button now loads on every page. Open it and enter the assistant access token in live mode. Tokens are only held in page memory, so reconnect after navigation/reload. The backend continues monitoring and keeps recent diagnoses meanwhile. Closed widgets show an unread update count after connecting. Open **http://127.0.0.1:8090/assistant/** for the standalone UI.

The gateway does not disable/strip Jenkins CSP. A restrictive custom Jenkins script policy may block the injected script: use an approved site-specific integration rather than weakening security globally. Existing reverse proxies can incorporate the reviewed snippet instead. Set Jenkins Location URL to the gateway origin if Jenkins reports a reverse-proxy warning. Public use requires your normal authenticated HTTPS gateway and its exact browser origin in JENKINS_FRAME_ORIGIN; this example is a private SSH demo.

Nginx docs: https://nginx.org/en/docs/http/ngx_http_sub_module.html
Jenkins proxy docs: https://www.jenkins.io/doc/book/system-administration/reverse-proxy-configuration-with-jenkins/reverse-proxy-configuration-nginx/

## Verify the complete flow

1. Start the assistant and let one polling sweep establish a baseline.
2. Open the gateway's Jenkins UI, open JenkinsAI, and connect with the assistant token.
3. Run `jenkins-ai-demo` with FAIL_TEST checked.
4. The monitor shows RUNNING (if a poll sees it) and then FAILURE. Automatic analysis follows when enabled. A very short build may only show its final status.
5. Run with FAIL_TEST unchecked. The monitor shows SUCCESS without a model call.
6. Reload Jenkins: the launcher remains. Reconnect; recent events/diagnoses are available.

On the demo EC2 instance, `sudo python3 deploy/verify-live.py` checks the private gateway, reader permissions, assistant API, monitor, and a Gemma response without printing credentials.

## Prototype limits

- One backend worker. State is in memory: restart seeds historical completed builds without analyzing them and discards old events. Builds completed while the service was offline are not replayed.
- Most recent 30 builds per job, 100 job/folder entries per sweep, 100 retained events, and 100 queued analyses. The UI reports scan truncation. Very busy servers need event ingestion and durable storage.
- Detection delay includes polling interval and sequential metadata request time. Each upstream call has a timeout. This is polling, not an instant Jenkins webhook.
- AI runs separately from the polling loop, reuses the two-analysis concurrency limit and shared 10 calls/minute limit, and retries provider/busy failures up to three times with a 60-second delay. Failed analysis is reported for manual retry.
- All holders of the shared assistant token see the reader's monitor events/diagnoses. This prototype does not enforce Jenkins per-user permissions or SSO.
- Demo mode is a static fixture, not a simulated moving pipeline. It shows monitor readiness and supports manual canned diagnosis; use live Jenkins to demonstrate transitions.
