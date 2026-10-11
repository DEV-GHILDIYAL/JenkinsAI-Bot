import os
import re
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    demo: bool = True
    api_key: str = ""
    model: str = "gemma-4-26b-a4b-it"
    jenkins_url: str = "http://127.0.0.1:8080"
    jenkins_user: str = ""
    jenkins_token: str = ""
    assistant_token: str = ""
    frame_origin: str = "http://127.0.0.1:8080"
    redact_values: str = ""

    @classmethod
    def from_env(cls):
        settings = cls(
            demo=os.getenv("DEMO_MODE", "true").lower() == "true",
            api_key=os.getenv("GEMINI_API_KEY", ""),
            model=os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it"),
            jenkins_url=os.getenv("JENKINS_URL", "http://127.0.0.1:8080").rstrip("/"),
            jenkins_user=os.getenv("JENKINS_USER", ""),
            jenkins_token=os.getenv("JENKINS_API_TOKEN", ""),
            assistant_token=os.getenv("ASSISTANT_TOKEN", ""),
            frame_origin=os.getenv("JENKINS_FRAME_ORIGIN", "http://127.0.0.1:8080"),
            redact_values=os.getenv("REDACT_VALUES", ""),
        )
        url = urlsplit(settings.jenkins_url)
        if url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError("JENKINS_URL must be a fixed HTTP(S) base URL without credentials, query, or fragment")
        if not re.fullmatch(r"gemma-4-[a-z0-9-]+", settings.model):
            raise ValueError("GEMMA_MODEL must be a Gemma 4 API model ID")
        origin = urlsplit(settings.frame_origin)
        if origin.scheme not in {"http", "https"} or not origin.netloc or origin.path or origin.query or origin.fragment or origin.username or origin.password or any(c.isspace() for c in settings.frame_origin):
            raise ValueError("JENKINS_FRAME_ORIGIN must be an exact HTTP(S) origin, without trailing slash")
        if not settings.demo and (not settings.api_key or not settings.jenkins_user or not settings.jenkins_token or len(settings.assistant_token) < 32):
            raise ValueError("Live mode requires Gemini/Jenkins credentials and an ASSISTANT_TOKEN of at least 32 characters")
        return settings

    def secrets(self):
        return [s for s in [self.api_key, self.jenkins_token, self.assistant_token, *self.redact_values.split("|")] if s]
