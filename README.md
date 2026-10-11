# JenkinsAI-Bot

**Failed builds. Clear next steps.** A read-only Jenkins debugging and DevOps assistant powered by hosted **Gemma 4 via the Gemini API**, built for Hacktoberfest Mumbai 2026 — **AI Belongs to Everyone**.

## What works

- Conversational DevOps Q&A, with bounded multi-turn history.
- Jenkins job/folder/multibranch navigation and FAILURE/UNSTABLE/ABORTED selection from the last 30 builds.
- Automatic console-log retrieval, redacted previews, line-numbered error neighborhoods, and explicit consent before model transmission.
- Evidence-led root-cause analysis, verification steps, suggested fixes, and Jenkinsfile/Groovy recommendations.
- Bottom-right web chat, plus an iframe widget for the Jenkins dashboard.
- Server-side build monitoring, status notifications, and opt-in automatic Gemma diagnoses for new failed builds. See [persistent widget and monitoring](docs/MONITORING.md).
- A separate Gemma terminal coding assistant that previews source files and proposes changes. It never runs commands or writes files.
- A labeled offline fixture for rehearsing without credentials, an MIT license, tests, and GitHub Actions.

**Demo mode uses canned responses and sends no network requests. It is not a live Gemma demonstration.** Use live mode for your submission demo.

## Quick start (Ubuntu / Linux / WSL)

```bash
git clone https://github.com/DEV-GHILDIYAL/JenkinsAI-Bot.git
cd JenkinsAI-Bot
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
cp .env.example .env
chmod 600 .env
set -a; . ./.env; set +a
.venv/bin/python -m uvicorn backend.app:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

Visit http://127.0.0.1:8000. Select **demo-api → #42 → Preview logs**, inspect the evidence, enable log sharing, click **Explain this failure**, then send. The response is explicitly labeled as offline.

On Windows, use `.venv\Scripts\python.exe`; set variables in PowerShell (`$env:DEMO_MODE='true'`) rather than sourcing `.env`. The application reads process environment only; `.env` is not auto-loaded.

## Connect real Jenkins and Gemma

Create a dedicated Jenkins reader identity. Use an authorization strategy such as Matrix Authorization to grant **Overall/Read** and **Job/Read** only for allowed jobs, plus folder visibility where needed. Do not grant build, configure, delete, credentials, administer, or script permissions. API tokens inherit the identity's permissions; a token is not itself a read-only scope.

Create a Gemini API key in Google AI Studio. Configure `.env` (local) or `/etc/jenkinsai.env` (systemd):

```dotenv
DEMO_MODE=false
GEMMA_MODEL=gemma-4-26b-a4b-it
GEMINI_API_KEY=YOUR_KEY
JENKINS_URL=http://127.0.0.1:8080
JENKINS_USER=assistant-reader
JENKINS_API_TOKEN=YOUR_READER_TOKEN
ASSISTANT_TOKEN=YOUR_RANDOM_TOKEN_AT_LEAST_32_CHARACTERS
JENKINS_FRAME_ORIGIN=http://127.0.0.1:8080
```

Generate the assistant access token with `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'`. For direct backend access, enter it into the web assistant's connection field. Through the private Jenkins widget gateway, signed-in Jenkins users connect automatically: Nginx checks their session and adds the token server-side. Never put it in a URL or frontend source. Set `REDACT_VALUES` to additional known literal secrets separated by `|` when needed. Restart the process after changing its environment.

`gemma-4-31b-it` is another documented hosted option. The application uses the Google REST `generateContent` endpoint, sends the API key in `x-goog-api-key`, and has no dependency on local model inference. Verify model access and quota in your own Google account. API access, quota, cost, and data use follow Google's current terms; best-effort redaction does not make sensitive logs safe automatically.

## EC2 deployment and dashboard widget

See [EC2 setup](docs/DEPLOYMENT.md) and [Jenkins widget setup](docs/JENKINS-WIDGET.md). The installer creates a separate unprivileged assistant service on **127.0.0.1:8000** and does not change Jenkins. Keep port 8000 private and use SSH forwarding for a hackathon demo.

The bookmarklet is a browser-session fallback. The supplied private Nginx gateway provides a persistent bottom-right widget on every Jenkins page through port 8090, respecting Jenkins CSP. See [setup](docs/MONITORING.md). This is not a packaged Jenkins Java plugin.

## Terminal coding assistant using only Gemma

```bash
export GEMINI_API_KEY='YOUR_KEY'
export GEMMA_MODEL='gemma-4-26b-a4b-it'
.venv/bin/python terminal_assistant.py --root .
```

Ask coding questions directly. `/file backend/jenkins.py` previews a redacted file locally; `/attach` explicitly consents to sending it with subsequent questions. `/clear` removes history and attachments; `/exit` quits. File access is constrained to the chosen root, credential directories/key files are blocked, and file context is capped. Review proposals and apply them yourself with your editor and Git. This is a conversational coding helper, not an autonomous agent or full IDE replacement.

## Architecture and trust boundaries

Browser widget → authenticated FastAPI → fixed Jenkins base (GET only) → redaction and bounded evidence → hosted Gemma 4 → plain-text response.

Jenkins and Google credentials exist on the backend only. The model has no tools, shell, deployment, or write endpoints. Log content is explicitly treated as untrusted input. Manual analysis requires per-build consent. Automatic monitoring sends redacted failed-build context only when the administrator explicitly enables `AUTO_ANALYZE_FAILURES=true`; that mode has no per-build preview. Chat messages and prior turns also go to Google in live mode. The monitor retains up to 100 events/diagnoses in server memory, lost on restart; no database or server chat persistence is used. Conversation is held in browser memory; clearing it removes client history, not monitor events or provider-held data.

The assistant access token is a **shared hackathon gate**: every holder can read every job accessible to the Jenkins service account. The private gateway requires a Jenkins login and keeps the token server-side, but it does not enforce per-user Jenkins job permissions. Limit the reader's visible jobs and restrict access to a trusted demo audience. Use per-user authorization, distributed limits, and audit controls before wider deployment.

Retrieval caps console downloads at 2 MB from the beginning and metadata at 2 MB. For larger logs, later output can be missing; the UI and model context flag that limit. Within retrieved lines, error neighborhoods plus a tail are selected and capped at 40,000 characters. Redaction covers known values, common credential assignments, bearer/basic authorization, private keys, AWS access-key IDs, common API tokens, JWTs, and credential-bearing URLs. It cannot detect all secrets, PII, encoded data, or unknown formats. Inspect the preview; do not enable sharing when sensitive data remains.

Read-only suggestions can still be incorrect or dangerous. Verify evidence and review commands before using them. The model's prompt mitigates prompt injection, but cannot guarantee resistance. Rate limits (10 chats/minute) and concurrency (2) are per-process/shared; use one worker for this prototype. Upstream timeouts are 20 seconds (Jenkins) and 90 seconds (Gemma); provider failures are returned without raw bodies or credentials.

## Verification and contributions

```bash
.venv/bin/python -m pytest -q
```

Tests cover authentication, consent, path traversal, fixed-origin GET-only requests, redirect refusal, bounded retrieval, secret redaction, model payloads/errors, history limits, rate limits, security headers, terminal file boundaries, and the demo workflow. Live Gemini/Jenkins integration requires your credentials and is a separate smoke check.

See [demo script](docs/DEMO.md), [contributing](CONTRIBUTING.md), and [security reporting](SECURITY.md).

## Hackathon provenance

The [Mumbai event](https://events.mlh.com/events/15178-hacktoberfest-hack-day-mumbai-x-fair) explicitly lists Gemma 4 via the Gemini API and requires a public GitHub repo with an open-source license for the open-source AI challenge. The event page does not specify whether Codex/Claude assistance during development is allowed; confirm any additional organizer rules. This initial scaffold was developed with Codex assistance. Its running AI features and bundled terminal assistant use Gemma 4 only; the offline fixture is deterministic. Disclose development tooling accurately in the submission.

Model/API references: [Gemma on Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api), [Jenkins Remote Access API](https://www.jenkins.io/doc/book/using/remote-access-api/).

MIT licenses this project's code. Upstream model/API usage is governed separately by Google's applicable terms.
