"""Single-worker, bounded polling monitor. No Jenkins write operations."""
import asyncio
import time
import uuid
from collections import deque

from fastapi import HTTPException

from .security import redact


class BuildMonitor:
    def __init__(self, settings, jenkins, analyze):
        self.s, self.jenkins, self.analyze = settings, jenkins, analyze
        self.events = deque(maxlen=100)
        self.seen = {}
        self.pending = {}
        self.sequence = 0
        self.last_poll = None
        self.error = None
        self.truncated = False
        self.job_count = 0
        self.task = None
        self.instance = uuid.uuid4().hex
        self.initialized = False
        self.started_at = time.time() * 1000

    def emit(self, kind, job, build, result, text):
        self.sequence += 1
        self.events.append({"id": self.sequence, "kind": kind,
                            "job": redact(job, self.s.secrets()), "build": build,
                            "result": result, "text": redact(text, self.s.secrets()),
                            "time": time.time()})

    def snapshot(self, after):
        return {"enabled": self.s.monitor_enabled, "auto_analyze": self.s.auto_analyze,
                "demo": self.s.demo, "interval": self.s.monitor_interval,
                "last_poll": self.last_poll, "error": self.error,
                "job_count": self.job_count, "truncated": self.truncated,
                "instance": self.instance, "cursor": self.sequence,
                "events": [e for e in self.events if e["id"] > after]}

    async def poll(self):
        folders, jobs, visited = [""], [], set()
        self.truncated = False
        # Bound metadata scans, including folders, to 100 entries per sweep.
        budget = 100
        while folders and budget:
            folder = folders.pop(0)
            if folder in visited:
                continue
            visited.add(folder)
            entries = await self.jenkins.jobs(folder)
            for entry in entries:
                if not budget:
                    self.truncated = True
                    break
                budget -= 1
                if entry["folder"]:
                    folders.append(entry["path"])
                else:
                    jobs.append(entry["path"])
        self.truncated = self.truncated or bool(folders)
        self.job_count = len(jobs)
        for job in jobs:
            builds = await self.jenkins.recent_builds(job)
            initial = job not in self.seen
            previous = self.seen.get(job, {})
            current = {}
            for build in reversed(builds):
                number = build["number"]
                result = "RUNNING" if build.get("building") else (build.get("result") or "PENDING")
                current[number] = result
                # Seed old completed builds without generating retrospective AI calls.
                old_baseline = initial and result != "RUNNING" and (
                    not self.initialized or build.get("timestamp", 0) < self.started_at
                )
                if old_baseline or previous.get(number) == result:
                    continue
                self.emit("build", job, number, result, f"{job} #{number}: {result}")
                if result in {"FAILURE", "UNSTABLE", "ABORTED"} and self.s.auto_analyze:
                    if len(self.pending) < 100:
                        self.pending[(job, number)] = {"attempts": 0, "retry_at": 0, "result": result}
                    else:
                        self.emit("analysis_error", job, number, result, "Analysis queue full. Preview this build and ask manually.")
            self.seen[job] = current
        # Prune jobs which disappeared or lost reader access.
        self.seen = {job: self.seen[job] for job in jobs if job in self.seen}
        self.last_poll, self.error = time.time(), None
        self.initialized = True

    async def analyze_next(self):
        for key, pending in list(self.pending.items()):
            if pending["retry_at"] > time.monotonic():
                continue
            job, number = key
            try:
                answer = await self.analyze(job, number)
                self.emit("analysis", job, number, pending["result"], answer)
                del self.pending[key]
            except HTTPException as exc:
                pending["attempts"] += 1
                pending["retry_at"] = time.monotonic() + 60
                if pending["attempts"] >= 3:
                    self.emit("analysis_error", job, number, pending["result"], str(exc.detail))
                    del self.pending[key]
            break

    async def run(self):
        while True:
            try:
                await self.poll()
            except Exception:
                self.error = "Monitoring could not read Jenkins. Check connectivity and reader permissions."
            await asyncio.sleep(self.s.monitor_interval)

    async def run_analysis(self):
        while True:
            try:
                await self.analyze_next()
            except Exception:
                self.error = "Automatic analysis failed. Check the service and provider configuration."
            await asyncio.sleep(1)

    async def start(self):
        if self.s.monitor_enabled:
            self.task = asyncio.create_task(self.run())
            self.analysis_task = asyncio.create_task(self.run_analysis())

    async def stop(self):
        if self.task:
            for task in [self.task, self.analysis_task]:
                task.cancel()
            await asyncio.gather(self.task, self.analysis_task, return_exceptions=True)
