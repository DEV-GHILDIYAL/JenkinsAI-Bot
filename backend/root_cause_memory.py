import hashlib
import re
import sqlite3
from contextlib import closing
from pathlib import Path

from .security import redact


ERROR_LINE = re.compile(r"(?i)\b(error|failed|exception|denied|fatal|not found|exit code)\b")
UUID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f-]{27,}\b", re.I)
LONG_HEX = re.compile(r"\b[0-9a-f]{12,}\b", re.I)
TIMESTAMP = re.compile(r"\b\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?Z?\b")


def error_signature(context, secrets=()):
    lines = []
    for line in context.get("log", "").splitlines():
        line = re.sub(r"^L\d+:\s*", "", line)
        if ERROR_LINE.search(line):
            normalized = redact(line, secrets).strip()
            normalized = TIMESTAMP.sub("<time>", normalized)
            normalized = UUID.sub("<id>", normalized)
            normalized = LONG_HEX.sub("<id>", normalized)
            normalized = re.sub(r"\s+", " ", normalized)[:240]
            if normalized and normalized not in lines:
                lines.append(normalized)
        if len(lines) == 6:
            break
    if not lines:
        return None
    canonical = "\n".join(lines).casefold()
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class RootCauseMemory:
    def __init__(self, database_path):
        self.database_path = str(database_path)
        if self.database_path == ":memory:":
            raise ValueError("Root-cause memory requires a persistent SQLite database path")

    def connect(self):
        Path(self.database_path).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute(
            """CREATE TABLE IF NOT EXISTS root_cause_memory (
                id INTEGER PRIMARY KEY,
                signature TEXT NOT NULL UNIQUE,
                root_cause TEXT NOT NULL,
                next_step TEXT NOT NULL,
                source_job TEXT NOT NULL,
                source_build INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                match_count INTEGER NOT NULL DEFAULT 0
            )"""
        )
        Path(self.database_path).chmod(0o600)
        return connection

    def find(self, signature):
        if not signature:
            return None
        with closing(self.connect()) as connection:
            row = connection.execute(
                """SELECT root_cause, next_step, source_job, source_build
                   FROM root_cause_memory WHERE signature = ?""",
                (signature,),
            ).fetchone()
            if row is None:
                return None
            connection.execute(
                "UPDATE root_cause_memory SET match_count = match_count + 1 WHERE signature = ?",
                (signature,),
            )
            connection.commit()
            return dict(row)

    def save(self, signature, root_cause, next_step, job, build):
        with closing(self.connect()) as connection:
            cursor = connection.execute(
                """INSERT OR IGNORE INTO root_cause_memory
                   (signature, root_cause, next_step, source_job, source_build)
                   VALUES (?, ?, ?, ?, ?)""",
                (signature, root_cause, next_step, job, build),
            )
            connection.commit()
            return cursor.rowcount == 1
