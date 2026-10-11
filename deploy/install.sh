#!/usr/bin/env bash
# Install ONLY the assistant. Does not modify/restart Jenkins or trigger builds.
set -euo pipefail
cd "$(dirname "$0")/.."
sudo apt-get update
sudo apt-get install -y python3-venv rsync
if ! id jenkinsai >/dev/null 2>&1; then
  sudo useradd --system --home-dir /opt/jenkinsai --shell /usr/sbin/nologin jenkinsai
fi
sudo install -d -o root -g root -m 755 /opt/jenkinsai
sudo rsync -a --exclude=.git --exclude=.env --exclude=.venv --exclude=__pycache__ --exclude=.pytest_cache ./ /opt/jenkinsai/
sudo python3 -m venv /opt/jenkinsai/.venv
sudo /opt/jenkinsai/.venv/bin/python -m pip install -r /opt/jenkinsai/requirements.txt
if ! sudo test -e /etc/jenkinsai.env; then
  sudo install -o root -g root -m 600 .env.example /etc/jenkinsai.env
fi
sudo install -m 644 deploy/jenkinsai.service /etc/systemd/system/jenkinsai.service
sudo systemctl daemon-reload
sudo systemctl enable --now jenkinsai
curl --fail --silent http://127.0.0.1:8000/health
printf '\nAssistant installed on loopback port 8000. Configure /etc/jenkinsai.env for live mode.\n'
