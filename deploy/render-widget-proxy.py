"""Render the private Nginx gateway with a server-only assistant credential."""

import os
import re
import tempfile
from pathlib import Path


root = Path(__file__).resolve().parent.parent
env_file = Path("/etc/jenkinsai.env")
output = Path("/etc/nginx/conf.d/jenkinsai.conf")
entries = dict(
    line.split("=", 1)
    for line in env_file.read_text().splitlines()
    if "=" in line and not line.lstrip().startswith("#")
)
token = entries.get("ASSISTANT_TOKEN", "")
if not re.fullmatch(r"[A-Za-z0-9_-]{32,}", token):
    raise ValueError("ASSISTANT_TOKEN must be a URL-safe token of at least 32 characters")

template = (root / "deploy/nginx-jenkinsai.conf").read_text()
if template.count("__ASSISTANT_TOKEN__") != 1:
    raise ValueError("Expected one assistant token placeholder")
rendered = template.replace("__ASSISTANT_TOKEN__", token)

with tempfile.NamedTemporaryFile(mode="w", dir=output.parent, prefix=".jenkinsai-", delete=False) as temp:
    temp.write(rendered)
    name = temp.name
try:
    os.chmod(name, 0o600)
    os.replace(name, output)
except BaseException:
    Path(name).unlink(missing_ok=True)
    raise
print("Private JenkinsAI gateway config rendered")
