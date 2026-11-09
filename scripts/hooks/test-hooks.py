import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time


SOURCE = Path(__file__).resolve().parent
CONFIG = json.loads((SOURCE.parents[1] / ".codex/hooks.json").read_text())
CLAUDE_CONFIG = json.loads((SOURCE.parents[1] / ".claude/settings.json").read_text())


def run(*args, cwd, **kwargs):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=True, **kwargs).stdout.strip()


def git(cwd, *args):
    return run("git", *args, cwd=cwd)


def hook(cwd, event, session="one", ledger="jubril", active=False, claude=False):
    config = CLAUDE_CONFIG if claude else CONFIG
    handler = config["hooks"][event][0]["hooks"][0]
    payload = json.dumps({"hook_event_name": event, "session_id": session, "cwd": str(cwd), "stop_hook_active": active})
    env = dict(os.environ, CM_LEDGER=ledger)
    env["CLAUDE_PROJECT_DIR"] = git(cwd, "rev-parse", "--show-toplevel")
    output = run("bash", "-c", handler["command"], cwd=cwd, input=payload, env=env, timeout=5)
    return json.loads(output) if output else None


with tempfile.TemporaryDirectory(prefix="cm-hook-test-") as temp:
    base = Path(temp)
    repo = base / "repo with spaces"
    remote = base / "remote.git"
    sibling = base / "crew"
    repo.mkdir()
    git(base, "init", "--bare", str(remote))
    git(repo, "init", "-b", "main")
    git(repo, "config", "user.name", "Hook Test")
    git(repo, "config", "user.email", "hook@example.test")
    (repo / "ledger").mkdir()
    (repo / "ledger/jubril.md").write_text("# Jubril\n\n## Now\nStarting.\n")
    (repo / "scripts").mkdir()
    shutil.copytree(SOURCE, repo / "scripts/hooks")
    git(repo, "add", ".")
    git(repo, "commit", "-m", "docs: fixture")
    git(repo, "remote", "add", "origin", str(remote))
    git(repo, "push", "-u", "origin", "main")
    subdir = repo / "scripts"

    first = hook(subdir, "SessionStart")
    assert first["hookSpecificOutput"]["hookEventName"] == "SessionStart"
    assert "docs: fixture" in first["hookSpecificOutput"]["additionalContext"]
    assert hook(subdir, "UserPromptSubmit") is None
    assert hook(subdir, "UserPromptSubmit", session="two") is not None
    assert hook(subdir, "SessionStart", session="claude", claude=True) is not None

    git(repo, "worktree", "add", "-b", "crew", str(sibling))
    assert hook(sibling, "UserPromptSubmit") is not None
    assert hook(repo, "Stop") is None

    (repo / "task.txt").write_text("work\n")
    git(repo, "add", "task.txt")
    git(repo, "commit", "-m", "feat: fixture work")
    assert hook(repo, "Stop", active=True) is None
    reminder = hook(repo, "Stop")
    assert reminder["decision"] == "block"
    assert "1 commit(s)" in reminder["reason"]
    assert hook(repo, "Stop") is None
    assert hook(repo, "Stop", session="two") is not None
    assert hook(repo, "Stop", session="claude", claude=True)["decision"] == "block"
    assert hook(repo, "Stop", session="invalid", ledger="../outside") is None
    assert hook(repo, "Stop", session="unset", ledger="") is None

    (repo / "ledger/jubril.md").write_text("# Jubril\n\n## Now\nUpdated.\n")
    assert hook(repo, "Stop", session="dirty") is None
    git(repo, "add", "ledger/jubril.md")
    git(repo, "commit", "-m", "docs(ledger): update fixture")
    assert hook(repo, "Stop", session="updated") is None

    time.sleep(0.2)
    git(repo, "push", "origin", "main")
    git(sibling, "fetch", "origin", "main")
    update = hook(sibling, "UserPromptSubmit")["hookSpecificOutput"]["additionalContext"]
    assert "feat: fixture work" in update
    assert "Updated." in update
    assert "2 behind" in update
    assert hook(sibling, "UserPromptSubmit") is None
    time.sleep(0.2)

print("Hook configuration, context, sessions, worktrees, remote updates and reminder guards passed.")
