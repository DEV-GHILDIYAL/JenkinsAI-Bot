#!/usr/bin/env bash
# Private, persistent Jenkins UI integration; does not restart Jenkins.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v nginx >/dev/null 2>&1; then
  printf 'Install nginx first (sudo apt-get install nginx), review its default listeners, then rerun this script.\n' >&2
  exit 1
fi
if ! sudo nginx -V 2>&1 | grep -q -- '--with-http_sub_module'; then
  printf 'nginx http_sub_module is required; config has not been installed.\n' >&2
  exit 1
fi
if sudo test -e /etc/nginx/conf.d/jenkinsai.conf; then
  printf 'Existing /etc/nginx/conf.d/jenkinsai.conf found. Review it before replacing.\n' >&2
  exit 1
fi
sudo install -m 644 deploy/nginx-jenkinsai.conf /etc/nginx/conf.d/jenkinsai.conf
if ! sudo nginx -t; then
  sudo rm -- /etc/nginx/conf.d/jenkinsai.conf
  printf 'New proxy config failed validation and was removed.\n' >&2
  exit 1
fi
sudo systemctl enable --now nginx
sudo systemctl reload nginx
printf 'Private widget gateway ready on 127.0.0.1:8090. Forward this port over SSH.\n'
