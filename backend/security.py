import re

ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
PATTERNS = [
    (r"-----BEGIN [^-]*PRIVATE KEY-----.*?(?:-----END [^-]*PRIVATE KEY-----|\Z)", "[REDACTED PRIVATE KEY]"),
    (r"(?i)(authorization\s*[:=]\s*(?:bearer|basic)\s+)\S+", r"\1[REDACTED]"),
    (r"(?i)((?:password|passwd|secret|token|api[_-]?key|access[_-]?key|credential)[\w-]*[\"']?\s*[:=]\s*)(?:\"[^\"\n]*\"|'[^'\n]*'|[^\s,;]+)", r"\1[REDACTED]"),
    (r"(?i)(https?://)[^\s/@]+:[^\s/@]+@", r"\1[REDACTED]@"),
    (r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b", "[REDACTED AWS KEY]"),
    (r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|AIza[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]+)\b", "[REDACTED TOKEN]"),
    (r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", "[REDACTED JWT]"),
]


def redact(text: str, secrets=()) -> str:
    text = ANSI.sub("", text)
    for secret in sorted(set(secrets), key=len, reverse=True):
        if secret:
            text = text.replace(secret, "[REDACTED]")
    for pattern, replacement in PATTERNS:
        text = re.sub(pattern, replacement, text, flags=re.DOTALL)
    return text


def excerpt(text: str, max_chars=40000):
    """Select error neighborhoods plus a tail; retain source line numbers."""
    lines = text.splitlines()
    selected = set(range(max(0, len(lines) - 120), len(lines)))
    matches = [i for i, line in enumerate(lines) if re.search(r"error|failed|exception|denied|not found|fatal|exit code", line, re.I)]
    for i in matches[-50:]:
        selected.update(range(max(0, i - 3), min(len(lines), i + 4)))
    numbered = [f"L{i + 1}: {lines[i]}" for i in sorted(selected)]
    result = "\n".join(numbered)
    if len(result) > max_chars:
        # Whole lines only; never cut a token mid-line.
        chosen, size = [], 0
        for line in reversed(numbered):
            if size + len(line) + 1 > max_chars:
                break
            chosen.append(line)
            size += len(line) + 1
        result = "\n".join(reversed(chosen))
    return result, len(lines), len(selected) < len(lines) or len(result) < len("\n".join(numbered))
