import re

REFUSAL = "I only answer Jenkins build questions about console output, results, and next verification steps."

_OFF_TOPIC = re.compile(
    r"(?i)\b(weather|joke|jokes|poem|poetry|recipe|song|lyrics|story|riddle|trivia|"
    r"translate|capital of|who won|ignore (all |your )?previous|system prompt|"
    r"you are now|act as(?! (?:a )?jenkins)|jailbreak|dan mode|"
    r"what is jenkins|install (?:jenkins|kubernetes)|set up jenkins|jenkins tutorial|"
    r"write (?:a |me )?(?:python|javascript|java|c\+\+|essay|email|blog))\b"
)
_BUILD = re.compile(
    r"(?i)\b(jenkins|jenkinsfile|groovy|job|build|pipeline|stage|console|log|"
    r"agent|node|executor|docker|daemon|socket|junit|surefire|maven|gradle|"
    r"npm|yarn|pytest|artifact|workspace|scm|checkout|git|plugin|timeout|"
    r"unstable|aborted|success|failure|failed|error|exception|denied|fatal|"
    r"exit(?: code)?|evidence|verdict|hidden issue|inspect|diagnos(?:e|is)|"
    r"cause|fix|verify|excerpt|dockerfile|permission|skipped|ignored|flaky|"
    r"retry|queue|controller|sh step|this run|this build|"
    r"fail|kyun|kyu|kaise|kya|batao|samjhao|dekho|check|dikhao|karo|iska|iski|isme|masla|wajah)\b"
)
_FOLLOW_UP = re.compile(
    r"(?i)^\s*(please\s+)?(why|how|what|which|where|when|is this|are these|"
    r"can i|could i|should i|fix|explain|next|cause|evidence|summar(?:y|ise|ize)|"
    r"diagnose|analy[sz]e|help|tell me|show me|"
    r"kyun|kyu|kya|kaise|batao|samjhao|check|dikhao|bata|ye|yeh|iska|iski)\b"
)
_BUILD_PATTERNS = [
    # Explicit "pipeline <job> [hai iska ka ki...] build #<num>"
    re.compile(
        r"(?i)\b(?:pipeline|job)\s+([a-zA-Z0-9_\-/\.]+)"
        r"(?:\s+(?:hai|iska|iski|ka|ki|ke|ko|mein|me|par|wala|wali))*"
        r"\s+(?:build|run)\s*(?:number|no\.?|#)?\s*#?(\d+)\b"
    ),
    # "build #<num> [of/ka/ki] pipeline/job <job>"
    re.compile(
        r"(?i)\b(?:build|run)\s*(?:number|no\.?|#)?\s*#?(\d+)\s+"
        r"(?:of|in|for|from|ka|ki|ke)?\s*(?:pipeline|job)\s+([a-zA-Z0-9_\-/\.]+)\b"
    ),
    # Direct "<job> build #<num>" (not preceded by 'this', 'that', 'current')
    re.compile(
        r"(?i)\b(?<!this\s)(?<!that\s)(?<!current\s)(?<!ye\s)(?<!yeh\s)([a-zA-Z0-9_\-/\.]+)"
        r"\s+(?:(?:ka|ki|ke|ko)\s+)?(?:build|run)\s*(?:number|no\.?|#)?\s*#?(\d+)\b"
    ),
]


def build_question_allowed(text: str) -> bool:
    question = (text or "").strip()
    if not question or len(question) > 4000:
        return False
    if _OFF_TOPIC.search(question):
        return False
    if parse_build_reference(question):
        return True
    if _BUILD.search(question):
        return True
    if not _FOLLOW_UP.match(question):
        return False
    if len(question) <= 30:
        return True
    return bool(re.search(r"(?i)\b(this|that|it|build|job|log|console|error|fail|stage|test|agent|pipeline|ye|yeh|kya|kyun|karo|batao)\b", question))


def parse_build_reference(text: str) -> tuple[str, int] | None:
    t = (text or "").strip()
    if not t or len(t) > 1000:
        return None
    for pattern in _BUILD_PATTERNS:
        match = pattern.search(t)
        if match:
            g1, g2 = match.group(1), match.group(2)
            if g1.isdigit() and not g2.isdigit():
                build_num = int(g1)
                job_name = g2.strip("`'\" ").strip()
            else:
                job_name = g1.strip("`'\" ").strip()
                build_num = int(g2)
            if job_name and len(job_name) <= 500 and job_name.lower() not in {"this", "that", "it", "current", "ye", "yeh"}:
                return job_name, build_num
    return None
