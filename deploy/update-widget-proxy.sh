#!/usr/bin/env bash
# Update the private gateway without printing or exposing the assistant token.
set -euo pipefail
cd "$(dirname "$0")/.."
config=/etc/nginx/conf.d/jenkinsai.conf
if ! sudo test -f "$config"; then
  printf 'Gateway not installed. Run bash deploy/install-widget-proxy.sh first.\n' >&2
  exit 1
fi
backup=$(sudo mktemp /etc/nginx/jenkinsai.conf.backup.XXXXXX)
sudo cp -p "$config" "$backup"
sudo chmod 600 "$backup"
if ! sudo python3 deploy/render-widget-proxy.py || ! sudo nginx -t; then
  sudo cp "$backup" "$config"
  sudo rm "$backup"
  printf 'Gateway config restored after update failure.\n' >&2
  exit 1
fi
if ! sudo systemctl reload nginx; then
  sudo cp "$backup" "$config"
  sudo systemctl reload nginx || true
  sudo rm "$backup"
  printf 'Gateway config restored after reload failure.\n' >&2
  exit 1
fi
sudo rm "$backup"
printf 'Private JenkinsAI gateway updated.\n'
