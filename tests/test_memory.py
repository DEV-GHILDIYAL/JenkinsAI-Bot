from dataclasses import replace

from fastapi.testclient import TestClient

from backend.app import create_app
from backend.chat_scope import parse_build_reference
from backend.config import Settings
from backend.root_cause_memory import RootCauseMemory, error_signature


def test_build_reference_parser_supports_job_and_pipeline_phrasing():
    assert parse_build_reference("Check pipeline team/api build #12") == ("team/api", 12)
    assert parse_build_reference("pipeline testing hai iska build number 7 check karo") == ("testing", 7)
    assert parse_build_reference("open testing pipeline build 1 and analyse it") == ("testing", 1)
    assert parse_build_reference("testing build #2 ko check karo") == ("testing", 2)
    assert parse_build_reference("Why did this build fail?") is None


def test_error_signature_ignores_log_line_numbers_and_redacts_secrets():
    first = {"log": "L10: npm: not found\nL11: API_KEY=private-value"}
    second = {"log": "L240: npm: not found\nL241: API_KEY=another-private-value"}
    secret = "another-private-value"
    assert error_signature(first) == error_signature(second, [secret])
    assert error_signature({"log": "L1: All tests passed"}) is None


def test_memory_persists_only_redacted_diagnosis_and_fingerprint(tmp_path):
    path = tmp_path / "memory.sqlite3"
    memory = RootCauseMemory(path)
    signature = error_signature({"log": "L2: npm: not found"})
    assert memory.save(signature, "Node.js is missing", "Install Node.js on the agent", "testing", 1)
    assert memory.find(signature) == {
        "root_cause": "Node.js is missing",
        "next_step": "Install Node.js on the agent",
        "source_job": "testing",
        "source_build": 1,
    }
    assert not memory.save(signature, "Another cause", "Another step", "testing", 2)
    assert b"npm: not found" not in path.read_bytes()


class FixtureJenkins:
    async def context(self, job, build):
        return {
            "job": job,
            "build": build,
            "result": "FAILURE",
            "building": False,
            "log": "L8: npm: not found",
            "excerpted": False,
            "download_truncated": False,
        }


class FixtureModel:
    def __init__(self):
        self.contexts = []
        self.messages = []

    async def chat(self, messages, context=None):
        self.contexts.append(context)
        self.messages.append(messages)
        if "Inspect this Jenkins console log" in messages[0].content:
            return (
                "VERDICT: FAILED\n"
                "CATEGORY: DEVOPS\n"
                "SUMMARY: Node.js is missing on this Jenkins agent.\n"
                "EVIDENCE: L8: npm: not found\n"
                "NEXT: Install Node.js/npm on the job agent."
            )
        return "Diagnosis based on this build."


def test_inspection_automatically_remembers_cause_for_later_build_and_chat_can_select_build(tmp_path):
    settings = replace(Settings(), memory_db_path=str(tmp_path / "memory.sqlite3"))
    model = FixtureModel()
    client = TestClient(create_app(settings, FixtureJenkins(), model))
    first = client.post("/api/inspect", json={"job": "testing", "build": 1}).json()
    assert first["memory_match"] is None

    later = client.post("/api/inspect", json={"job": "another-pipeline", "build": 8}).json()
    assert later["memory_match"]["source_job"] == "testing"
    assert later["memory_match"]["source_build"] == 1
    assert model.contexts[-1]["prior_learned_diagnosis"]["root_cause"] == first["summary"]

    chat = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "Check pipeline another-pipeline build #9"}],
            "job": "testing",
            "build": 1,
            "share_logs": True,
        },
    )
    assert chat.status_code == 200
    assert chat.json()["job"] == "another-pipeline"
    assert chat.json()["build"] == 9
    assert chat.json()["memory_match"]["source_build"] == 1
    assert len(model.messages[-1]) == 1


def test_uncertain_or_incomplete_diagnoses_are_not_learned(tmp_path):
    class UncertainModel(FixtureModel):
        async def chat(self, messages, context=None):
            return (
                "VERDICT: UNCERTAIN\nCATEGORY: UNCERTAIN\n"
                "SUMMARY: Cause is unclear.\nEVIDENCE: None\nNEXT: None"
            )

    class SuccessfulJenkins(FixtureJenkins):
        async def context(self, job, build):
            context = await super().context(job, build)
            context["result"] = "SUCCESS"
            return context

    settings = replace(Settings(), memory_db_path=str(tmp_path / "memory.sqlite3"))
    client = TestClient(create_app(settings, SuccessfulJenkins(), UncertainModel()))
    response = client.post("/api/inspect", json={"job": "testing", "build": 1})
    assert response.status_code == 200
    assert response.json()["verdict"] == "UNCERTAIN"

    later = client.post("/api/inspect", json={"job": "another-pipeline", "build": 8})
    assert later.status_code == 200
    assert later.json()["memory_match"] is None


def test_diagnosis_without_a_real_cited_log_line_is_not_learned(tmp_path):
    class UncitedModel(FixtureModel):
        async def chat(self, messages, context=None):
            return (
                "VERDICT: FAILED\nCATEGORY: DEVOPS\n"
                "SUMMARY: Node.js is missing.\n"
                "EVIDENCE: L999: npm: not found\nNEXT: Install Node.js."
            )

    settings = replace(Settings(), memory_db_path=str(tmp_path / "memory.sqlite3"))
    client = TestClient(create_app(settings, FixtureJenkins(), UncitedModel()))
    client.post("/api/inspect", json={"job": "testing", "build": 1})
    later = client.post("/api/inspect", json={"job": "another-pipeline", "build": 8})
    assert later.json()["memory_match"] is None
