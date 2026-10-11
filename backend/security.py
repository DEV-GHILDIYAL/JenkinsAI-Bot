import re

ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
PATTERNS = [
    # RSA, EC, OpenSSH Private Keys
    (r"-----BEGIN [^-]*PRIVATE KEY-----.*?(?:-----END [^-]*PRIVATE KEY-----|\Z)", "[REDACTED PRIVATE KEY]"),
    # Passwords, API Keys, Tokens in key-value or JSON or env format
    (r"(?i)((?:password|passwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|app[_-]?secret|private[_-]?key|credential)[\w-]*[\"']?\s*[:=]\s*)(?:\"[^\"\n]*\"|'[^'\n]*'|[^\s,;]+)", r"\1[REDACTED]"),
    # Authorization Headers (Bearer, Basic, Token)
    (r"(?i)(authorization\s*[:=]\s*(?:bearer|basic|token)\s+)\S+", r"\1[REDACTED]"),
    # URL credentials: http://user:password@host
    (r"(?i)(https?|postgres|postgresql|mysql|mongodb|redis)://[^\s/@]+:[^\s/@]+@", r"\1://[REDACTED]@"),
    # AWS Keys (AKIA, ASIA and Secret Access Keys 40 chars)
    (r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b", "[REDACTED AWS ACCESS KEY]"),
    (r"(?i)(aws_secret_access_key\s*[:=]\s*)[A-Za-z0-9/+=]{40}", r"\1[REDACTED AWS SECRET]"),
    # GitHub Tokens (ghp_, gho_, ghu_, ghs_, ghr_, github_pat_)
    (r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{30,})\b", "[REDACTED GITHUB TOKEN]"),
    # Google API Keys (AIza...), Slack Tokens (xox[baprs]-...), Generic API tokens
    (r"\bAIza[0-9A-Za-z-_]{35}\b", "[REDACTED GOOGLE API KEY]"),
    (r"\bxox[baprs]-[0-9A-Za-z-]{10,}\b", "[REDACTED SLACK TOKEN]"),
    # JSON Web Tokens (JWT)
    (r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", "[REDACTED JWT]"),
    # .env style variable assignments: KEY=value
    (r"(?i)\b((?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|DATABASE_URL)_[A-Z0-9_]*\s*=\s*)\S+", r"\1[REDACTED]"),
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
