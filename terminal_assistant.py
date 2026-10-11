"""Gemma 4 terminal coding assistant. Suggests changes; never executes/writes them."""
import argparse
import asyncio
import os
from pathlib import Path

from backend.config import Settings
from backend.model import Gemma
from backend.security import redact

BLOCKED = {".env", ".git", ".ssh", ".aws", ".venv", "node_modules", "__pycache__"}


def read_file(root: Path, name: str, secrets=()):
    path = (root / name).resolve()
    if not path.is_relative_to(root) or any(p in BLOCKED or p.startswith(".env") for p in path.relative_to(root).parts) or path.suffix.lower() in {".pem", ".key", ".p12", ".pfx", ".log"}:
        raise ValueError("File must be inside the repository and must not be a credential/log file")
    if path.stat().st_size > 100000:
        raise ValueError("File exceeds 100 KB limit")
    content = path.read_text(encoding="utf-8")
    if "\x00" in content:
        raise ValueError("Binary file is not supported")
    return redact(content, secrets)


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Repository root")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        parser.error("Set GEMINI_API_KEY in your environment")
    model = os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it")
    import re
    if not re.fullmatch(r"gemma-4-[a-z0-9-]+", model):
        parser.error("GEMMA_MODEL must be a Gemma 4 API model ID")
    s = Settings(demo=False, api_key=key, model=model, redact_values=os.getenv("REDACT_VALUES", ""))
    ai = Gemma(s)
    history, files = [], {}
    print(f"Gemma terminal assistant · {model}\nProposals only. No command execution or file writes.\n/file path = preview a file; /attach = consent to send preview; /clear = clear; /exit = quit")
    pending = None
    while True:
        try:
            line = input("\ngemma> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if line == "/exit":
            break
        if line == "/clear":
            history, files, pending = [], {}, None
            print("Conversation and file context cleared.")
            continue
        if line.startswith("/file "):
            try:
                name = line[6:].strip()
                content = read_file(root, name, s.secrets())
                # Preview exactly what will be transmitted; bound context independently.
                if len(content) > 10000:
                    raise ValueError("File exceeds 10,000-character prompt limit; use a smaller source file")
                pending = (name, content)
                print(content)
                print("Review for secrets. /attach consents to sending this content to Google in subsequent questions.")
            except (OSError, ValueError, UnicodeError) as error:
                pending = None
                print(f"Cannot preview file: {error}")
            continue
        if line == "/attach":
            if pending:
                if sum(len(v) for k, v in files.items() if k != pending[0]) + len(pending[1]) > 10000:
                    print("Combined file context exceeds 10,000 characters. /clear first.")
                else:
                    files[pending[0]] = pending[1]
                    print("File attached for the next questions. /clear removes all attachments.")
                    pending = None
            else:
                print("Use /file path to preview a source file first.")
            continue
        if not line:
            continue
        if len(line) > 12000:
            print("Question exceeds 12,000 characters.")
            continue
        from backend.app import Message
        candidate = [*history[-8:], Message(role="user", content=line)]
        if sum(len(m.content) for m in candidate) > 40000:
            print("Conversation too long. /clear and retry.")
            continue
        try:
            context = {"untrusted_source_files": files} if files else None
            answer = await ai.chat(candidate, context)
            print("\n" + answer)
            history = [*candidate, Message(role="model", content=answer[:12000])]
        except Exception as error:
            from fastapi import HTTPException
            print(error.detail if isinstance(error, HTTPException) else "Request failed. Check API access and connection.")


if __name__ == "__main__":
    asyncio.run(main())
