import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def read_event():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def emit_block(reason):
    print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))


def parse_time(value):
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def latest_running_state(cwd):
    root = Path(cwd)
    runs = root / ".codex" / "app-active-runs"
    if not runs.exists():
        return None, None

    current = runs / "current"
    if current.exists():
        try:
            current_name = current.read_text(encoding="utf-8-sig").strip()
            current_state = runs / current_name / "run-state.json"
            state = read_state(current_state)
            if state and state.get("status") == "running" and state.get("stop_guard") is True:
                return current_state, state
        except Exception:
            pass

    newest = None
    newest_mtime = -1.0
    for state_path in runs.glob("*/run-state.json"):
        try:
            mtime = state_path.stat().st_mtime
        except Exception:
            continue
        if mtime > newest_mtime:
            newest = state_path
            newest_mtime = mtime
    if newest:
        state = read_state(newest)
        if state and state.get("status") == "running" and state.get("stop_guard") is True:
            return newest, state
    return None, None


def read_state(state_path):
    try:
        return json.loads(state_path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None


def last_nonempty_line(path):
    chunk_size = 4096
    buffer = b""
    max_tail_bytes = 1024 * 1024
    with path.open("rb") as handle:
        handle.seek(0, os.SEEK_END)
        position = handle.tell()
        while position > 0 and len(buffer) <= max_tail_bytes:
            read_size = min(chunk_size, position, max_tail_bytes - len(buffer) + 1)
            position -= read_size
            handle.seek(position)
            buffer = handle.read(read_size) + buffer
            lines = buffer.splitlines()
            if position > 0:
                lines = lines[1:]
            for line in reversed(lines):
                if line.strip():
                    return line.decode("utf-8-sig")
    return ""


def progress_ready(run_dir):
    progress_md = run_dir / "progress.md"
    progress_jsonl = run_dir / "progress.jsonl"
    if not progress_md.exists():
        return False, "missing progress.md"
    if not progress_jsonl.exists():
        return False, "missing progress.jsonl"
    try:
        line = last_nonempty_line(progress_jsonl)
        if not line:
            return False, "progress.jsonl has no cycle events"
        event = json.loads(line)
    except Exception:
        return False, "latest progress.jsonl event is not valid JSON"
    required = [
        "timestamp",
        "cycle",
        "phase",
        "elapsed_minutes",
        "task",
        "files_changed",
        "commands",
        "validation",
        "self_review",
        "reviewer",
        "blocker",
        "next_step",
    ]
    missing = [key for key in required if key not in event]
    if missing:
        return False, "latest progress event missing: " + ", ".join(missing)
    return True, ""


def learning_ready(run_dir):
    required_files = [
        "lessons-learned.md",
        "improvement-candidates.jsonl",
        "promotion-report.md",
        "promotion-report.json",
    ]
    missing_files = [name for name in required_files if not (run_dir / name).exists()]
    if missing_files:
        return False, "missing learning artifacts: " + ", ".join(missing_files)

    ok, detail = promotion_report_ready(run_dir / "promotion-report.json")
    if not ok:
        return False, detail

    candidates_path = run_dir / "improvement-candidates.jsonl"
    try:
        line = last_nonempty_line(candidates_path)
    except Exception:
        return False, "improvement-candidates.jsonl cannot be read"

    if not line:
        return True, ""

    try:
        candidate = json.loads(line)
    except Exception:
        return False, "latest improvement-candidates.jsonl line is not valid JSON"

    required = [
        "timestamp",
        "run_id",
        "source",
        "category",
        "risk",
        "scope",
        "problem",
        "evidence",
        "proposal",
        "target_files",
        "validation",
        "promotion_decision",
        "status",
    ]
    missing = [key for key in required if key not in candidate]
    if missing:
        return False, "latest improvement candidate missing: " + ", ".join(missing)

    valid_sources = {
        "self_review",
        "reviewer",
        "validation_failure",
        "blocker",
        "repeated_friction",
        "user_correction",
    }
    valid_categories = {
        "project-local",
        "global-prompt",
        "global-validation",
        "global-safety",
        "release",
        "documentation",
        "performance",
    }
    valid_risks = {"low", "medium", "high"}
    valid_scopes = {"project", "codex-global", "repo-template", "release"}
    valid_decisions = {"auto-apply", "shadow-backlog", "reject"}
    valid_statuses = {"proposed", "validating", "applied", "shadowed", "rejected"}

    enum_checks = [
        ("source", valid_sources),
        ("category", valid_categories),
        ("risk", valid_risks),
        ("scope", valid_scopes),
        ("promotion_decision", valid_decisions),
        ("status", valid_statuses),
    ]
    for key, valid_values in enum_checks:
        if candidate.get(key) not in valid_values:
            return False, f"latest improvement candidate has invalid {key}: {candidate.get(key)!r}"

    string_fields = [
        "timestamp",
        "run_id",
        "problem",
        "evidence",
        "proposal",
        "validation",
    ]
    for key in string_fields:
        value = candidate.get(key)
        if not isinstance(value, str) or not value.strip():
            return False, f"latest improvement candidate has invalid {key}"

    target_files = candidate.get("target_files")
    if not isinstance(target_files, list) or not all(isinstance(item, str) and item.strip() for item in target_files):
        return False, "latest improvement candidate target_files must be a list of strings"

    if candidate["risk"] == "high" or candidate["category"] in {"global-safety", "release"}:
        if candidate["promotion_decision"] != "shadow-backlog" or candidate["status"] != "shadowed":
            return False, "high-risk, global-safety, and release learning candidates must be shadowed"

    if candidate["promotion_decision"] == "reject" and candidate["status"] not in {"rejected", "proposed"}:
        return False, "rejected learning candidates must use rejected or proposed status"

    if candidate["promotion_decision"] == "auto-apply" and candidate["status"] == "shadowed":
        return False, "auto-applied learning candidates cannot be shadowed"
    return True, ""


def nonempty_string(value):
    return isinstance(value, str) and bool(value.strip())


def string_list(value):
    return isinstance(value, list) and all(nonempty_string(item) for item in value)


def promotion_report_ready(path):
    try:
        report = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return False, "promotion-report.json is missing or not valid JSON"

    required = [
        "generated_at",
        "repository",
        "version",
        "status",
        "promotion",
        "validation",
        "install_result",
        "git",
        "github",
        "reviewer",
        "steps",
    ]
    missing = [key for key in required if key not in report]
    if missing:
        return False, "promotion-report.json missing: " + ", ".join(missing)

    if report.get("status") not in {"pending", "passed", "failed", "dry-run", "skipped"}:
        return False, f"promotion-report.json has invalid status: {report.get('status')!r}"

    promotion = report.get("promotion")
    if not isinstance(promotion, dict):
        return False, "promotion-report.json promotion must be an object"
    for key in ["categories", "changed_files", "candidate_files"]:
        if key not in promotion:
            return False, f"promotion-report.json promotion missing {key}"
    categories = promotion.get("categories")
    if not string_list(categories):
        return False, "promotion-report.json promotion.categories must be a list of strings"
    if not isinstance(promotion.get("changed_files"), list):
        return False, "promotion-report.json promotion.changed_files must be a list"
    if not isinstance(promotion.get("candidate_files"), list):
        return False, "promotion-report.json promotion.candidate_files must be a list"
    if not nonempty_string(promotion.get("validation_policy")):
        return False, "promotion-report.json promotion.validation_policy is required"

    validation = report.get("validation")
    if not isinstance(validation, list):
        return False, "promotion-report.json validation must be a list"

    install_result = report.get("install_result")
    if not isinstance(install_result, dict) or not nonempty_string(install_result.get("status")):
        return False, "promotion-report.json install_result.status is required"
    if not nonempty_string(install_result.get("codex_home")):
        return False, "promotion-report.json install_result.codex_home is required"
    if not nonempty_string(install_result.get("manifest_version")):
        return False, "promotion-report.json install_result.manifest_version is required"

    git = report.get("git")
    if not isinstance(git, dict) or not nonempty_string(git.get("branch")):
        return False, "promotion-report.json git.branch is required"
    if not nonempty_string(git.get("commit_sha")):
        return False, "promotion-report.json git.commit_sha is required"

    github = report.get("github")
    if not isinstance(github, dict) or not isinstance(github.get("push_result"), dict):
        return False, "promotion-report.json github.push_result is required"
    if not nonempty_string(github["push_result"].get("status")):
        return False, "promotion-report.json github.push_result.status is required"
    release = github.get("release")
    if not isinstance(release, dict):
        return False, "promotion-report.json github.release is required"
    release_status = release.get("status")
    if release_status in {"success", "passed", "created", "updated"}:
        release_url = release.get("release_url") or release.get("url")
        if not nonempty_string(release_url):
            return False, "promotion-report.json github.release release_url is required for successful releases"

    reviewer = report.get("reviewer")
    if not isinstance(reviewer, dict):
        return False, "promotion-report.json reviewer is required"
    if not isinstance(reviewer.get("required"), bool):
        return False, "promotion-report.json reviewer.required must be boolean"
    if not isinstance(reviewer.get("used"), bool):
        return False, "promotion-report.json reviewer.used must be boolean"
    if not nonempty_string(reviewer.get("agent_type")):
        return False, "promotion-report.json reviewer.agent_type is required"
    required_review_categories = {"global-prompt", "global-validation", "performance"}
    if required_review_categories.intersection(set(categories)):
        if reviewer.get("used") is not True or not nonempty_string(reviewer.get("result")):
            return False, "global prompt, validation, and performance promotions require reviewer result"

    if not isinstance(report.get("steps"), list):
        return False, "promotion-report.json steps must be a list"

    return True, ""


def main():
    event = read_event()
    if event.get("stop_hook_active") is True:
        return

    cwd = event.get("cwd") or event.get("working_directory") or os.getcwd()
    state_path, state = latest_running_state(cwd)
    if not state_path:
        return

    run_dir = state_path.parent
    ok, detail = progress_ready(run_dir)
    if not ok:
        emit_block(
            f"Autonomous run is still active but progress logging is incomplete ({detail}). "
            f"Update {run_dir} progress files, run the next useful validation, and continue."
        )
        return

    ok, detail = learning_ready(run_dir)
    if not ok:
        emit_block(
            f"Autonomous run is still active but learning artifacts are incomplete ({detail}). "
            f"Update lessons-learned.md, improvement-candidates.jsonl, promotion-report.md, "
            f"promotion-report.json, then continue the next useful cycle."
        )
        return

    now = datetime.now(timezone.utc)
    deadline = parse_time(state.get("deadline"))
    if deadline and deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    if deadline and now >= deadline:
        emit_block(
            f"Autonomous run deadline has arrived but run-state.json is still status=running. "
            f"Close the run by setting status to completed or blocked, record stop_reason, "
            f"and produce the final readiness summary."
        )
        return

    emit_block(
        f"Autonomous run is still active. Continue the next cycle from {run_dir}, "
        f"then update progress.md, progress.jsonl, and run-state.json before stopping."
    )


if __name__ == "__main__":
    main()
