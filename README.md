# JenkinsAI-Bot

**Open Console Output. Get a short diagnosis.** A read-only Jenkins inspector powered by hosted **Gemma 4 via the Gemini API**, built for Hacktoberfest Mumbai 2026 — **AI Belongs to Everyone**.

## What works

- A compact popup appears when a signed-in user opens a Jenkins build's **Console Output** through the private gateway.
- Gemma checks the opened build's redacted console excerpt and returns a verdict, one evidence line, and one next step.
- After the diagnosis, **Ask about this build** opens an optional chat. The bot answers Jenkins build questions about console output, results, and next steps; other topics are refused before a model call.
- The popup chat can target another job/build when named explicitly (for example, `Check pipeline testing build #12`). Submitting shares that build's redacted excerpt with Gemma.
- Jenkins `SUCCESS` is checked for unresolved log errors too; the popup can flag a **Hidden issue**.
- Running builds are rechecked every 15 seconds. Completed results are cached in memory.
- For an `ISSUE` or `FAILED` result, users can confirm **Remember this cause**. The server keeps a normalized error fingerprint, redacted cause/next step, and source build—not raw logs—and shows it for exact matching errors.
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

The popup requires the Jenkins gateway. See [gateway setup](docs/MONITORING.md). Demo mode is a static fixture with no model request.

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

The systemd service stores confirmed root-cause memory in `/var/lib/jenkinsai/memory.sqlite3`. `MEMORY_DB_PATH` can point to another persistent server-side SQLite path. Entries are shared by users of the service and remain until an administrator removes the database.

Generate the assistant access token with `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'`. Through the private gateway, signed-in Jenkins users connect automatically: Nginx checks their session and adds the token server-side. Never put it in a URL or frontend source. Set `REDACT_VALUES` to additional known literal secrets separated by `|` when needed. Restart the process after changing its environment. For console-only use, set `MONITOR_ENABLED=false` and `AUTO_ANALYZE_FAILURES=false`.

`gemma-4-31b-it` is another documented hosted option. The application uses the Google REST `generateContent` endpoint, sends the API key in `x-goog-api-key`, and has no dependency on local model inference. Verify model access and quota in your own Google account. API access, quota, cost, and data use follow Google's current terms; best-effort redaction does not make sensitive logs safe automatically.

## EC2 deployment and dashboard widget

See [EC2 setup](docs/DEPLOYMENT.md) and [Jenkins widget setup](docs/JENKINS-WIDGET.md). The installer creates a separate unprivileged assistant service on **127.0.0.1:8000** and does not change Jenkins. Keep port 8000 private and use SSH forwarding for a hackathon demo.

The private Nginx gateway injects the script through port 8090; the popup appears only on build Console Output pages. See [setup](docs/MONITORING.md). This is not a packaged Jenkins Java plugin.

## Terminal coding assistant using only Gemma

```bash
export GEMINI_API_KEY='YOUR_KEY'
export GEMMA_MODEL='gemma-4-26b-a4b-it'
.venv/bin/python terminal_assistant.py --root .
```

Ask coding questions directly. `/file backend/jenkins.py` previews a redacted file locally; `/attach` explicitly consents to sending it with subsequent questions. `/clear` removes history and attachments; `/exit` quits. File access is constrained to the chosen root, credential directories/key files are blocked, and file context is capped. Review proposals and apply them yourself with your editor and Git. This is a conversational coding helper, not an autonomous agent or full IDE replacement.

## Architecture and trust boundaries

Console popup → authenticated FastAPI → fixed Jenkins base (GET only) → redaction and bounded evidence → hosted Gemma 4 → short verdict. Optional follow-up chat can use the open build or a named pipeline/build; off-topic questions are refused without a model call.

Jenkins and Google credentials exist on the backend only. The model has no tools, shell, deployment, or write endpoints. Log content is treated as untrusted input. Opening Console Output automatically sends that build's redacted excerpt to Gemma; there is no per-build consent dialog. Only signed-in gateway users can call the endpoint. Completed verdicts are cached in server memory and lost on restart.

Root-cause memory is a separate explicit user action. The server persists only a fingerprint, redacted cause/next step, and source build metadata; raw console logs are not stored. The database is shared among users of this service and must be treated as shared operational knowledge.

The assistant access token is a **shared hackathon gate**: every holder can read every job accessible to the Jenkins service account. The private gateway requires a Jenkins login and keeps the token server-side, but it does not enforce per-user Jenkins job permissions. Limit the reader's visible jobs and restrict access to a trusted demo audience. Use per-user authorization, distributed limits, and audit controls before wider deployment.

Retrieval caps console downloads at 2 MB from the beginning and metadata at 2 MB. For larger logs, later output can be missing; the UI and model context flag that limit. Within retrieved lines, error neighborhoods plus a tail are selected and capped at 40,000 characters. Redaction covers known values, common credential assignments, bearer/basic authorization, private keys, AWS access-key IDs, common API tokens, JWTs, and credential-bearing URLs. It cannot detect all secrets, PII, encoded data, or unknown formats; restrict use to trusted demo jobs.

Read-only suggestions can still be incorrect. Verify the cited line before acting. Rate limits (10 analyses/minute) and concurrency (2) are per-process/shared; use one worker for this prototype. Upstream timeouts are 20 seconds (Jenkins) and 90 seconds (Gemma); provider failures are returned without raw bodies or credentials.

## Verification and contributions

```bash
.venv/bin/python -m pytest -q
```

Tests cover authentication, consent, build-only chat scope and build selection, recurring-error memory persistence/matching, path traversal, fixed-origin GET-only requests, redirect refusal, bounded retrieval, secret redaction, model payloads/errors, history limits, rate limits, security headers, terminal file boundaries, and the demo workflow. Live Gemini/Jenkins integration requires your credentials and is a separate smoke check.

See [demo script](docs/DEMO.md), [contributing](CONTRIBUTING.md), and [security reporting](SECURITY.md).

## Hackathon provenance

The [Mumbai event](https://events.mlh.com/events/15178-hacktoberfest-hack-day-mumbai-x-fair) explicitly lists Gemma 4 via the Gemini API and requires a public GitHub repo with an open-source license for the open-source AI challenge. The event page does not specify whether Codex/Claude assistance during development is allowed; confirm any additional organizer rules. This initial scaffold was developed with Codex assistance. Its running AI features and bundled terminal assistant use Gemma 4 only; the offline fixture is deterministic. Disclose development tooling accurately in the submission.

Model/API references: [Gemma on Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api), [Jenkins Remote Access API](https://www.jenkins.io/doc/book/using/remote-access-api/).

MIT licenses this project's code. Upstream model/API usage is governed separately by Google's applicable terms.
