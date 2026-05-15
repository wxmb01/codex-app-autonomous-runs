import json
import re
import sys


def read_event():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def emit_deny(reason):
    print(json.dumps({"decision": "deny", "reason": reason}, ensure_ascii=False))


def compact(text):
    return re.sub(r"\s+", " ", text.replace("`", "")).strip().lower()


def tool_text(event):
    value = event.get("tool_input", event.get("input", {}))
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        parts = []
        for key in ("command", "cmd", "script", "patch", "input"):
            item = value.get(key)
            if isinstance(item, str):
                parts.append(item)
        if not parts:
            parts.extend(str(v) for v in value.values() if isinstance(v, str))
        return "\n".join(parts)
    return ""


def dangerous_command_reason(text):
    normalized = compact(text)
    checks = [
        (r"(^|[;&|]\s*)git\s+reset\s+--hard\b", "git reset --hard can discard user work."),
        (r"(^|[;&|]\s*)git\s+clean\s+-(?:f?d|x?df)\b", "git clean can delete untracked user files."),
        (r"(^|[;&|]\s*)gh\s+release\s+create\b", "creating a release requires a human checkpoint."),
        (r"(^|[;&|]\s*)npm\s+publish\b", "publishing a package requires a human checkpoint."),
        (r"(^|[;&|]\s*)pnpm\s+publish\b", "publishing a package requires a human checkpoint."),
        (r"(^|[;&|]\s*)yarn\s+publish\b", "publishing a package requires a human checkpoint."),
        (r"(^|[;&|]\s*)docker\s+push\b", "pushing an image requires a human checkpoint."),
        (r"(^|[;&|]\s*)kubectl\s+(apply|delete|replace|patch)\b", "changing cluster state requires a human checkpoint."),
        (r"(^|[;&|]\s*)helm\s+(install|upgrade|uninstall)\b", "changing cluster releases requires a human checkpoint."),
        (r"(^|[;&|]\s*)(terraform|tofu)\s+(apply|destroy)\b", "changing infrastructure requires a human checkpoint."),
        (r"(^|[;&|]\s*)pulumi\s+(up|destroy)\b", "changing infrastructure requires a human checkpoint."),
        (r"(^|[;&|]\s*)vercel\s+deploy\b.*\s--prod\b", "production deploy requires a human checkpoint."),
        (r"(^|[;&|]\s*)netlify\s+deploy\b.*\s--prod\b", "production deploy requires a human checkpoint."),
        (r"(^|[;&|]\s*)firebase\s+deploy\b", "deploy requires a human checkpoint."),
        (r"(^|[;&|]\s*)wrangler\s+deploy\b", "deploy requires a human checkpoint."),
        (r"(^|[;&|]\s*)rm\s+-rf\b", "recursive force deletion requires a human checkpoint."),
        (r"remove-item\b(?=.*\s-recurse\b)(?=.*\s-force\b)", "recursive force deletion requires a human checkpoint."),
        (r"format-volume\b", "formatting a volume is destructive."),
        (r"drop\s+database\b", "destructive database operations require a human checkpoint."),
        (r"delete\s+from\b(?!.*\bwhere\b)", "broad database deletes require a human checkpoint."),
    ]
    for pattern, reason in checks:
        if re.search(pattern, normalized):
            return reason
    return None


def secret_write_reason(text):
    lowered = text.lower()
    path_patterns = [
        r"(^|\n)\*\*\* (add|update|delete) file: .*(^|[\\/])\.env(\.|$)",
        r"(^|\n)\*\*\* (add|update|delete) file: .*\.(pem|p12|pfx|key)$",
        r"(^|\n)\*\*\* (add|update|delete) file: .*(^|[\\/])id_rsa$",
        r"(^|\n)\*\*\* (add|update|delete) file: .*(^|[\\/])secrets?[\\/]",
    ]
    for pattern in path_patterns:
        if re.search(pattern, lowered, re.MULTILINE):
            return "editing secrets or credential files requires a human checkpoint."
    if "-----begin private key-----" in lowered:
        return "private key material must not be written by autonomous runs."
    return None


def main():
    event = read_event()
    text = tool_text(event)
    if not text:
        return

    reason = dangerous_command_reason(text) or secret_write_reason(text)
    if reason:
        emit_deny(reason)


if __name__ == "__main__":
    main()
