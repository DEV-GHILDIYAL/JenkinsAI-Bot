from urllib.parse import quote

import httpx
from fastapi import HTTPException

from .security import excerpt, redact

DEMO_LOG = """Started by user demo
[Pipeline] node
Running on ubuntu-agent in /var/lib/jenkins/workspace/demo-api
[Pipeline] stage
[Pipeline] { (Build image)
[Pipeline] sh
+ docker build -t demo-api:42 .
ERROR: permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock
[Pipeline] }
[Pipeline] End of Pipeline
ERROR: script returned exit code 1
Finished: FAILURE"""


def job_path(job: str):
    parts = job.split("/")
    if len(parts) > 12 or len(job) > 500 or any(not p or p in {".", ".."} or any(ord(c) < 32 or c in "\\%?#" for c in p) for p in parts):
        raise HTTPException(400, "Invalid job path")
    return "/".join("job/" + quote(p, safe="") for p in parts)


class Jenkins:
    def __init__(self, settings, transport=None):
        self.s = settings
        self.transport = transport

    def client(self):
        return httpx.AsyncClient(auth=(self.s.jenkins_user, self.s.jenkins_token), timeout=20, follow_redirects=False, trust_env=False, transport=self.transport)

    async def read(self, path, params=None, limit=2_000_000):
        # All URLs are constructed from the fixed administrator base; ONLY GET.
        try:
            async with self.client() as client:
                async with client.stream("GET", f"{self.s.jenkins_url}/{path}", params=params) as response:
                    if response.status_code != 200:
                        code = 404 if response.status_code == 404 else 502
                        raise HTTPException(code, "Jenkins read failed; check URL, reader permissions, and credentials")
                    chunks, size, cut = [], 0, False
                    async for chunk in response.aiter_bytes():
                        remaining = limit - size
                        chunks.append(chunk[:remaining])
                        size += min(len(chunk), remaining)
                        if len(chunk) > remaining or size >= limit:
                            cut = True
                            break
                    return b"".join(chunks), cut
        except httpx.HTTPError:
            raise HTTPException(502, "Jenkins unavailable or request timed out") from None

    async def json(self, path, tree):
        import json
        data, cut = await self.read(path + "/api/json" if path else "api/json", {"tree": tree})
        if cut:
            raise HTTPException(502, "Jenkins metadata exceeds retrieval limit")
        try:
            return json.loads(data)
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(502, "Jenkins returned invalid metadata") from None

    async def jobs(self, folder=""):
        path = job_path(folder) if folder else ""
        if self.s.demo:
            return [{"name": "demo-api", "path": "demo-api", "folder": False}]
        result = await self.json(path, "jobs[name,_class]")
        return [{"name": j["name"], "path": f"{folder}/{j['name']}".lstrip("/"), "folder": "Folder" in j.get("_class", "") or "MultiBranch" in j.get("_class", "") or "OrganizationFolder" in j.get("_class", "")} for j in result.get("jobs", [])]

    async def builds(self, job):
        path = job_path(job)
        if self.s.demo:
            if job != "demo-api":
                raise HTTPException(404, "Demo job not found")
            return [{"number": 42, "result": "FAILURE", "timestamp": 0, "duration": 16000, "building": False}]
        result = await self.json(path, "builds[number,result,timestamp,duration,building]{0,30}")
        return [b for b in result.get("builds", []) if b.get("result") in {"FAILURE", "UNSTABLE", "ABORTED"}]

    async def context(self, job, build):
        path = f"{job_path(job)}/{build}"
        if self.s.demo:
            if job != "demo-api" or build != 42:
                raise HTTPException(404, "Demo build not found")
            meta, raw, cut = {"result": "FAILURE", "building": False, "number": 42}, DEMO_LOG, False
        else:
            meta = await self.json(path, "number,result,building,duration,timestamp")
            data, cut = await self.read(path + "/consoleText")
            raw = data.decode("utf-8", errors="replace")
            if cut:
                raw = raw.rsplit("\n", 1)[0] if "\n" in raw else ""
        cleaned = redact(raw, self.s.secrets())
        log, count, selected = excerpt(cleaned)
        return {"job": redact(job, self.s.secrets()), "build": build, "result": meta.get("result"), "building": meta.get("building", False), "log": log, "source_lines": count, "excerpted": selected, "download_truncated": cut, "redaction": "best-effort; inspect before sending", "demo": self.s.demo}
