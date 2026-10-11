import asyncio
import secrets
import time
from collections import deque
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

from .config import Settings
from .jenkins import Jenkins
from .model import Gemma


class Message(BaseModel):
    role: Literal["user", "model"]
    content: str = Field(min_length=1, max_length=12000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=20)
    job: str | None = Field(default=None, max_length=500)
    build: int | None = Field(default=None, ge=1)
    share_logs: bool = False

    @model_validator(mode="after")
    def valid_conversation(self):
        if self.messages[-1].role != "user" or self.messages[0].role != "user":
            raise ValueError("Conversation must begin and end with user")
        if any(m.role == self.messages[i-1].role for i, m in enumerate(self.messages) if i):
            raise ValueError("Conversation roles must alternate")
        if sum(len(m.content) for m in self.messages) > 40000:
            raise ValueError("Conversation is too long; clear it and retry")
        if (self.job is None) != (self.build is None):
            raise ValueError("Job and build must be selected together")
        if self.job is not None and not self.share_logs:
            raise ValueError("Explicit consent is required to send logs")
        return self


def create_app(settings=None, jenkins=None, model=None):
    s = settings or Settings.from_env()
    j = jenkins or Jenkins(s)
    ai = model or Gemma(s)
    app = FastAPI(title="JenkinsAI Bot", docs_url=None, redoc_url=None, openapi_url=None)
    frontend = Path(__file__).resolve().parent.parent / "frontend"
    app.mount("/static", StaticFiles(directory=frontend), name="static")
    calls = deque()
    active = asyncio.Semaphore(2)

    @app.middleware("http")
    async def limits_and_headers(request: Request, call_next):
        if request.method == "POST":
            size, chunks = 0, []
            async for chunk in request.stream():
                size += len(chunk)
                if size > 128000:
                    return JSONResponse({"detail": "Request too large"}, status_code=413)
                chunks.append(chunk)
            request._body = b"".join(chunks)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = f"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self' {s.frame_origin}; base-uri 'none'; form-action 'self'"
        return response

    def authorize(request: Request):
        if s.demo:
            return
        supplied = request.headers.get("authorization", "")
        if not secrets.compare_digest(supplied, f"Bearer {s.assistant_token}"):
            raise HTTPException(401, "Enter the assistant access token")

    @app.get("/")
    async def home():
        return FileResponse(frontend / "index.html")

    @app.get("/health")
    async def health():
        return {"status": "ok", "demo": s.demo, "model": s.model, "read_only": True}

    @app.get("/api/jobs", dependencies=[Depends(authorize)])
    async def jobs(folder: str = Query(default="", max_length=500)):
        return {"jobs": await j.jobs(folder)}

    @app.get("/api/builds", dependencies=[Depends(authorize)])
    async def builds(job: str = Query(max_length=500)):
        return {"builds": await j.builds(job)}

    @app.get("/api/context", dependencies=[Depends(authorize)])
    async def context(job: str = Query(max_length=500), build: int = Query(ge=1)):
        return await j.context(job, build)

    @app.post("/api/chat", dependencies=[Depends(authorize)])
    async def chat(body: ChatRequest):
        now = time.monotonic()
        while calls and calls[0] < now - 60:
            calls.popleft()
        if len(calls) >= 10:
            raise HTTPException(429, "Shared demo access limit reached; retry in a minute")
        if active.locked():
            raise HTTPException(429, "Two analyses are already running; retry shortly")
        calls.append(now)
        async with active:
            ctx = await j.context(body.job, body.build) if body.job is not None else None
            answer = await ai.chat(body.messages, ctx)
        return {"answer": answer, "demo": s.demo, "model": None if s.demo else s.model, "context": {k: v for k, v in ctx.items() if k != "log"} if ctx else None}

    return app
