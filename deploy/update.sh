#!/usr/bin/env bash
# Run after git pull from the repository checkout. Preserve server credentials.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! sudo test -f /etc/jenkinsai.env; then
  printf 'First installation: run bash deploy/install.sh\n' >&2
  exit 1
fi
sudo rsync -a --exclude=.git --exclude=.env --exclude=.venv --exclude=__pycache__ --exclude=.pytest_cache ./ /opt/jenkinsai/
sudo /opt/jenkinsai/.venv/bin/python -m pip install -r /opt/jenkinsai/requirements.txt
sudo install -m 644 deploy/jenkinsai.service /etc/systemd/system/jenkinsai.service
sudo systemctl daemon-reload
sudo systemctl restart jenkinsai
for attempt in {1..15}; do
  if curl --fail --silent http://127.0.0.1:8000/health; then
    printf '\nJenkinsAI updated. Refresh the assistant page.\n'
    exit 0
  fi
  sleep 1
done
sudo systemctl status jenkinsai --no-pager
exit 1
