import asyncio
import time
from dataclasses import replace

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.config import Settings
from backend.jenkins import Jenkins
from backend.monitor import BuildMonitor


class FixtureJenkins:
    def __init__(self):
        self.builds = {"demo": [{"number": 1, "result": "FAILURE", "building": False}]}

    async def jobs(self, folder=""):
        return [{"name": job, "path": job, "folder": False} for job in self.builds]

    async def recent_builds(self, job):
        return self.builds[job]


def test_running_completion_and_parallel_builds_are_detected_once():
    async def exercise():
        jenkins = FixtureJenkins()
        calls = []

        async def analyze(job, number):
            calls.append((job, number))
            return "Diagnosis"

        monitor = BuildMonitor(replace(Settings(), auto_analyze=True), jenkins, analyze)
        await monitor.poll()
        assert not monitor.events and not monitor.pending
        jenkins.builds["demo"] = [
            {"number": 3, "result": None, "building": True},
            {"number": 2, "result": None, "building": True},
        ]
        await monitor.poll()
        assert [e["result"] for e in monitor.events] == ["RUNNING", "RUNNING"]
        jenkins.builds["demo"][1] = {"number": 2, "result": "FAILURE", "building": False}
        await monitor.poll()
        await monitor.poll()
        await monitor.analyze_next()
        await monitor.analyze_next()
        assert calls == [("demo", 2)]
        assert [e["kind"] for e in monitor.events] == ["build", "build", "build", "analysis"]
        # A short build that starts and finishes between polls is still detected.
        jenkins.builds["demo"].insert(0, {"number": 4, "result": "SUCCESS", "building": False})
        await monitor.poll()
        assert monitor.events[-1]["result"] == "SUCCESS"
        # A newly created job is monitored too, without a running snapshot.
        jenkins.builds["new"] = [{"number": 1, "result": "FAILURE", "building": False, "timestamp": time.time() * 1000}]
        await monitor.poll()
        assert ("new", 1) in monitor.pending
        jenkins.builds["old-visible-now"] = [{"number": 1, "result": "FAILURE", "building": False, "timestamp": 0}]
        await monitor.poll()
        assert ("old-visible-now", 1) not in monitor.pending
    asyncio.run(exercise())


def test_status_only_monitor_never_calls_model():
    async def exercise():
        async def forbidden(*args):
            raise AssertionError("No automatic log transmission without opt-in")

        jenkins = FixtureJenkins()
        monitor = BuildMonitor(Settings(), jenkins, forbidden)
        await monitor.poll()
        jenkins.builds["demo"].insert(0, {"number": 2, "result": "FAILURE", "building": False})
        await monitor.poll()
        await monitor.analyze_next()
        assert len(monitor.events) == 1 and not monitor.pending
    asyncio.run(exercise())


def test_analysis_retries_are_bounded_and_errors_redacted():
    async def exercise():
        async def unavailable(*args):
            raise HTTPException(502, "Provider unavailable: secret-marker")

        s = replace(Settings(), auto_analyze=True, redact_values="secret-marker")
        monitor = BuildMonitor(s, FixtureJenkins(), unavailable)
        monitor.pending[("demo", 2)] = {"attempts": 0, "retry_at": 0, "result": "FAILURE"}
        for _ in range(3):
            monitor.pending[("demo", 2)]["retry_at"] = 0
            await monitor.analyze_next()
        assert not monitor.pending
        assert monitor.events[-1]["kind"] == "analysis_error"
        assert "secret-marker" not in monitor.events[-1]["text"]
    asyncio.run(exercise())


def test_monitor_api_auth_and_lifecycle():
    s = replace(Settings(), demo=False, assistant_token="a" * 40, monitor_enabled=False)
    with TestClient(create_app(s)) as client:
        assert client.get("/api/monitor").status_code == 401
        response = client.get("/api/monitor", headers={"Authorization": "Bearer " + s.assistant_token})
        assert response.status_code == 200 and response.json()["enabled"] is False
    with TestClient(create_app(Settings())) as client:
        response = client.get("/api/monitor").json()
        assert response["auto_analyze"] is False


def test_recent_builds_includes_success_and_running_without_changing_failure_picker():
    builds = [{"number": 3, "result": None, "building": True},
              {"number": 2, "result": "SUCCESS", "building": False},
              {"number": 1, "result": "FAILURE", "building": False}]
    jenkins = Jenkins(replace(Settings(), demo=False), httpx.MockTransport(
        lambda request: httpx.Response(200, json={"builds": builds})))
    assert len(asyncio.run(jenkins.recent_builds("job"))) == 3
    assert [b["number"] for b in asyncio.run(jenkins.builds("job"))] == [1]
