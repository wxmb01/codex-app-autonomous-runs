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
    candidates = sorted(
        runs.glob("*/run-state.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for state_path in candidates:
        try:
            state = json.loads(state_path.read_text(encoding="utf-8-sig"))
        except Exception:
            continue
        if state.get("status") == "running" and state.get("stop_guard") is True:
            return state_path, state
    return None, None


def progress_ready(run_dir):
    progress_md = run_dir / "progress.md"
    progress_jsonl = run_dir / "progress.jsonl"
    if not progress_md.exists():
        return False, "missing progress.md"
    if not progress_jsonl.exists():
        return False, "missing progress.jsonl"
    try:
        lines = [line for line in progress_jsonl.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
        if not lines:
            return False, "progress.jsonl has no cycle events"
        event = json.loads(lines[-1])
    except Exception:
        return False, "latest progress.jsonl event is not valid JSON"
    required = ["timestamp", "cycle", "task", "commands", "validation", "reviewer", "blocker", "next_step"]
    missing = [key for key in required if key not in event]
    if missing:
        return False, "latest progress event missing: " + ", ".join(missing)
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
