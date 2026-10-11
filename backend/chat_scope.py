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
    r"retry|queue|controller|sh step|this run|this build)\b"
)
_FOLLOW_UP = re.compile(
    r"(?i)^\s*(please\s+)?(why|how|what|which|where|when|is this|are these|"
    r"can i|could i|should i|fix|explain|next|cause|evidence|summar(?:y|ise|ize)|"
    r"diagnose|analy[sz]e|help|tell me|show me)\b"
)
_BUILD_REFERENCE = re.compile(
    r"(?i)\b(?:pipeline|job)\s+(.+?)\s+"
    r"(?:(?:hai|iska|ka|ki|ke)\s+)*(?:build|run)"
    r"\s*(?:number|no\.?)?\s*#?\s*(\d+)\b"
)


def build_question_allowed(text: str) -> bool:
    question = (text or "").strip()
    if not question or len(question) > 4000:
        return False
    if _OFF_TOPIC.search(question):
        return False
    if _BUILD.search(question):
        return True
    if not _FOLLOW_UP.match(question):
        return False
    if len(question) <= 24:
        return True
    return bool(re.search(r"(?i)\b(this|that|it|build|job|log|console|error|fail|stage|test|agent|pipeline)\b", question))


def parse_build_reference(text: str) -> tuple[str, int] | None:
    match = _BUILD_REFERENCE.search(text or "")
    if not match:
        return None
    job = match.group(1).strip().strip("`'\" ")
    if not job or len(job) > 500:
        return None
    return job, int(match.group(2))
