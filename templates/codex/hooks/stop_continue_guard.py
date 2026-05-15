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
    with path.open("rb") as handle:
        handle.seek(0, os.SEEK_END)
        position = handle.tell()
        while position > 0:
            read_size = min(chunk_size, position)
            position -= read_size
            handle.seek(position)
            buffer = handle.read(read_size) + buffer
            lines = buffer.splitlines()
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
