# Ubuntu EC2 deployment

Jenkins and Java are already installed; this project does not reinstall or restart them. Hosted Gemma inference means your 8 GB server only runs the lightweight HTTP service alongside Jenkins. Actual capacity depends on Jenkins executor load; no load benchmark is claimed.

## Install the assistant

On the server:

```bash
git clone https://github.com/DEV-GHILDIYAL/JenkinsAI-Bot.git
cd JenkinsAI-Bot
bash deploy/install.sh
```

This installs Python venv support/rsync, creates the `jenkinsai` service account, copies application code to `/opt/jenkinsai`, creates a root-only environment file at `/etc/jenkinsai.env`, and starts a single-worker systemd service. Default mode is offline demo. It never sends build triggers or changes Jenkins jobs.

Switch to live mode by editing secrets directly on EC2 with `sudoedit /etc/jenkinsai.env`, using the README settings, then:

```bash
sudo systemctl restart jenkinsai
sudo systemctl status jenkinsai --no-pager
curl --fail http://127.0.0.1:8000/health
```

`/health` checks process/configuration only; it does not validate provider credentials. For a live smoke check, connect in the web UI, list your permitted Jenkins jobs, preview one failed build, then send a question with explicit log consent. Ensure the footer says the Gemma model rather than OFFLINE DEMO.

## Private demo over SSH

Run from your existing WSL terminal, where the PEM permissions are already configured:

```bash
ssh -o ConnectTimeout=10 -i ~/JenkinsAI-Server-Key.pem \
  -L 8000:127.0.0.1:8000 -L 8080:127.0.0.1:8080 ubuntu@3.110.55.60
```

Open http://127.0.0.1:8000 for the assistant and http://127.0.0.1:8080 for Jenkins. If those local ports are occupied, choose different left-hand port numbers and adjust `JENKINS_FRAME_ORIGIN` to the Jenkins URL you open in your browser. Keep the SSH tunnel open. Do not add a public security-group rule for port 8000.

`JENKINS_URL` is the server-side address (usually loopback), while `JENKINS_FRAME_ORIGIN` is the browser-visible Jenkins origin. They may differ. The latter must be an exact origin without a path or trailing slash. TLS is required for shared/public access; avoid exposing Jenkins or this assistant over public plain HTTP.

## Optional reverse proxy

An existing authenticated HTTPS reverse proxy can map `/assistant/` to `http://127.0.0.1:8000/`. Preserve the trailing slash in both the location and proxy target so the prefix is stripped. The frontend resolves static and API URLs relative to that prefix. Set a request body cap of 128 KB and a read timeout above 90 seconds. Set `JENKINS_FRAME_ORIGIN` to your Jenkins HTTPS origin. Do not replace existing Jenkins proxy configuration blindly or disable CSP globally.

## Operate / stop

`sudo journalctl -u jenkinsai -n 50 --no-pager` shows service diagnostics. Access logging is disabled; the code does not log requests or console content. `sudo systemctl stop jenkinsai` stops only the assistant. To disable startup use `sudo systemctl disable jenkinsai`. Existing environment secrets are preserved when rerunning the installer. After code updates, explicitly restart the assistant.

The service account has no shell and a read-only filesystem under systemd hardening. Python dependencies are installed by the administrator. Keep credential files out of Git and archives.
