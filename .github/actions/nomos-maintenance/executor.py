#!/usr/bin/env python3
"""Nomos maintenance executor, running inside the customer's Actions boundary.

ARCHITECTURE v2.0 Sections 5.2, 5.3, 6.1. This implements the ``Executor``
contract: it applies the job's bounded replacement steps, runs the requested
checks, and reports a structured result. It never decides whether the result is
good enough -- that is the Verifier's job, server-side.

Deliberate constraints, all from Section 5.2's operational controls:

* no raw code is logged or printed
* no repository cache or source-containing artifact is uploaded
* the only content sent to Nomos is structured metadata: paths, counts,
  content hashes, exit codes, timings, and redacted stderr excerpts
* the temporary workspace is the runner's own checkout, cleaned up by GitHub

Standard library only, so the Action needs no dependency installation step
inside a customer's environment.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

EXECUTOR_NAME = "github-actions"
EXECUTOR_VERSION = "action-v1"
STDERR_EXCERPT_LIMIT = 2_000
REQUEST_TIMEOUT = 30

# Anything matching these is removed before an excerpt leaves the runner. This
# is a backstop, not the primary control: excerpts are already truncated and
# only tool stderr is ever captured.
_REDACTIONS = (
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    re.compile(r"(?i)(authorization|bearer|token|secret|password)[\"'\s:=]+\S+"),
)


class ExecutorError(RuntimeError):
    pass


def log(message: str) -> None:
    """Progress only. Never repository content."""
    print(f"[nomos] {message}", flush=True)


def redact(text: str) -> str:
    for pattern in _REDACTIONS:
        text = pattern.sub("[redacted]", text)
    return text[:STDERR_EXCERPT_LIMIT]


def request_json(
    url: str,
    *,
    method: str = "GET",
    body: dict | None = None,
    token: str | None = None,
) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Accept", "application/json")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            payload = response.read().decode()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()[:500]
        raise ExecutorError(f"{method} {url} failed: HTTP {exc.code} {detail}") from exc
    except urllib.error.URLError as exc:
        raise ExecutorError(f"{method} {url} failed: {exc.reason}") from exc
    return json.loads(payload) if payload else {}


def github_oidc_token(audience: str) -> str:
    """Ask the runner for an OIDC token proving which repository we are."""
    url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    runtime_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not url or not runtime_token:
        raise ExecutorError(
            "OIDC is unavailable. The calling workflow needs 'permissions: id-token: write'."
        )
    request = urllib.request.Request(f"{url}&audience={audience}")
    request.add_header("Authorization", f"Bearer {runtime_token}")
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        payload = json.loads(response.read().decode())
    token = payload.get("value")
    if not isinstance(token, str) or not token:
        raise ExecutorError("Runner returned an empty OIDC token")
    return token


def apply_step(root: Path, step: dict) -> tuple[str, str]:
    """Apply one bounded replacement. Returns (before, after) for diff counting."""
    relative = step["path"]
    target = root / relative
    if not target.is_file() or target.is_symlink():
        raise ExecutorError(f"Planned file is unavailable: {relative}")
    before = target.read_text(encoding="utf-8")
    start_line = step.get("start_line")
    end_line = step.get("end_line")
    expected = int(step.get("expected_occurrences") or 1)
    old = step["old"]
    new = step["new"]

    if start_line is None and end_line is None:
        if before.count(old) != expected:
            raise ExecutorError(
                f"Replacement occurrence count does not match the plan in {relative}"
            )
        after = before.replace(old, new)
    else:
        lines = before.splitlines(keepends=True)
        start = (start_line or 1) - 1
        end = end_line or len(lines)
        if start < 0 or end > len(lines) or end < start:
            raise ExecutorError(f"Replacement line range is invalid in {relative}")
        segment = "".join(lines[start:end])
        if segment.count(old) != expected:
            raise ExecutorError(f"Bounded replacement count does not match in {relative}")
        lines[start:end] = [segment.replace(old, new)]
        after = "".join(lines)

    target.write_text(after, encoding="utf-8")
    return before, after


def count_changes(before: str, after: str) -> tuple[int, int]:
    import difflib

    diff = list(
        difflib.unified_diff(before.splitlines(keepends=True), after.splitlines(keepends=True))
    )
    additions = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
    deletions = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))
    return additions, deletions


def run_check(check_type: str, command: list[str], root: Path) -> dict:
    started = time.monotonic()
    try:
        completed = subprocess.run(  # noqa: S603 - fixed command lists only
            command,
            cwd=root,
            capture_output=True,
            timeout=600,
            check=False,
        )
    except FileNotFoundError:
        # The tool is not installed in this repository's environment. That is
        # unavailable, not a failure, and never a pass.
        return {
            "check_type": check_type,
            "status": "unavailable",
            "stderr_classification": "tool_not_installed",
            "duration_ms": int((time.monotonic() - started) * 1000),
        }
    except subprocess.TimeoutExpired:
        return {
            "check_type": check_type,
            "status": "failed",
            "stderr_classification": "timeout",
            "duration_ms": int((time.monotonic() - started) * 1000),
        }
    stderr = completed.stderr.decode(errors="replace")
    return {
        "check_type": check_type,
        "status": "passed" if completed.returncode == 0 else "failed",
        "exit_code": completed.returncode,
        "duration_ms": int((time.monotonic() - started) * 1000),
        "stderr_classification": None if completed.returncode == 0 else "nonzero_exit",
        "stderr_excerpt": None if completed.returncode == 0 else redact(stderr),
    }


def build_checks(spec: dict, root: Path, changed_paths: list[str]) -> list[dict]:
    """Run the checks the plan asked for, plus the ones Nomos always requires."""
    checks: list[dict] = []
    plan = set(spec.get("verification_plan") or [])

    checks.append(_parse_check(root, changed_paths))
    checks.append(_path_check(spec, changed_paths))
    checks.append(_size_check(spec, changed_paths, root))
    checks.append(_secret_check(root, changed_paths))

    if "typecheck" in plan and (root / "tsconfig.json").exists():
        checks.append(run_check("typecheck", ["npx", "--no-install", "tsc", "--noEmit"], root))
    if "lint" in plan and (root / "package.json").exists():
        checks.append(run_check("lint", ["npx", "--no-install", "eslint", *changed_paths], root))
    if "focused_tests" in plan:
        focused = spec.get("focused_test_paths") or []
        if focused:
            checks.append(run_check("focused_tests", ["python", "-m", "pytest", *focused], root))
        else:
            checks.append({"check_type": "focused_tests", "status": "skipped"})
    return checks


def _parse_check(root: Path, changed_paths: list[str]) -> dict:
    import ast

    for relative in changed_paths:
        if not relative.endswith(".py"):
            continue
        try:
            ast.parse((root / relative).read_text(encoding="utf-8"))
        except SyntaxError:
            return {
                "check_type": "parse",
                "status": "failed",
                "stderr_classification": "syntax_error",
                # The path, never the offending line.
                "summary": {"path": relative},
            }
    return {"check_type": "parse", "status": "passed", "exit_code": 0}


def _path_check(spec: dict, changed_paths: list[str]) -> dict:
    allowed = set(spec.get("allowed_paths") or [])
    outside = [path for path in changed_paths if allowed and path not in allowed]
    return {
        "check_type": "policy_path_validation",
        "status": "failed" if outside else "passed",
        "summary": {"outside_plan": outside},
    }


def _size_check(spec: dict, changed_paths: list[str], root: Path) -> dict:
    max_files = int(spec.get("max_changed_files") or 10)
    return {
        "check_type": "diff_size_validation",
        "status": "failed" if len(changed_paths) > max_files else "passed",
        "summary": {"changed_files": len(changed_paths), "max_changed_files": max_files},
    }


def _secret_check(root: Path, changed_paths: list[str]) -> dict:
    """Scan the changed files for secrets before anything is reported or pushed."""
    patterns = (
        re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
        re.compile(r"AKIA[0-9A-Z]{16}"),
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        re.compile(r"sk_live_[A-Za-z0-9]{16,}"),
    )
    hits: list[str] = []
    for relative in changed_paths:
        try:
            content = (root / relative).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if any(pattern.search(content) for pattern in patterns):
            # The path only. Reporting the match would upload the secret.
            hits.append(relative)
    return {
        "check_type": "secret_scanning",
        "status": "failed" if hits else "passed",
        "summary": {"files_with_matches": hits},
    }


def main() -> int:
    api_url = os.environ["NOMOS_API_URL"].rstrip("/")
    job_id = os.environ["NOMOS_JOB_ID"]
    audience = os.environ.get("NOMOS_AUDIENCE", "nomos-maintenance-executor")
    root = Path(os.environ.get("GITHUB_WORKSPACE", ".")).resolve()
    started_at = datetime.now(UTC)

    log("requesting OIDC identity from the runner")
    oidc_token = github_oidc_token(audience)

    log("exchanging OIDC identity for a job-scoped Nomos credential")
    exchange = request_json(
        f"{api_url}/api/v1/execution/tokens",
        method="POST",
        body={"maintenance_job_id": job_id, "oidc_token": oidc_token},
    )
    token = exchange["token"]

    log("fetching the maintenance job")
    spec = request_json(f"{api_url}/api/v1/execution/jobs/{job_id}", token=token)

    status = "succeeded"
    failure_detail: dict = {}
    changed_files: list[dict] = []
    changed_lines = 0
    checks: list[dict] = []
    branch_pushed = False
    head_commit: str | None = None

    try:
        totals: dict[str, tuple[int, int]] = {}
        for step in spec.get("steps", []):
            before, after = apply_step(root, step)
            additions, deletions = count_changes(before, after)
            path = step["path"]
            previous = totals.get(path, (0, 0))
            totals[path] = (previous[0] + additions, previous[1] + deletions)

        for path, (additions, deletions) in sorted(totals.items()):
            digest = hashlib.sha256((root / path).read_bytes()).hexdigest()
            changed_files.append(
                {
                    "path": path,
                    "additions": additions,
                    "deletions": deletions,
                    "content_sha256": digest,
                    "generated": False,
                }
            )
            changed_lines += additions + deletions

        log(f"applied {len(changed_files)} file(s); running checks")
        checks = build_checks(spec, root, [item["path"] for item in changed_files])
        if (
            os.environ.get("NOMOS_PUSH_BRANCH", "false").lower() == "true"
            and spec.get("mode") == "pull_request"
            and all(check.get("status") in {"passed", "skipped"} for check in checks)
        ):
            branch = str(spec["branch_name"])
            subprocess.run(["git", "config", "user.name", "Nomos"], cwd=root, check=True)
            subprocess.run(["git", "config", "user.email", "bot@nomos.local"], cwd=root, check=True)
            subprocess.run(["git", "checkout", "-B", branch], cwd=root, check=True)
            subprocess.run(["git", "add", "--", *[item["path"] for item in changed_files]], cwd=root, check=True)
            subprocess.run(["git", "commit", "-m", "Nomos maintenance"], cwd=root, check=True)
            subprocess.run(["git", "push", "origin", f"HEAD:refs/heads/{branch}"], cwd=root, check=True)
            head_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
            branch_pushed = True
    except ExecutorError as exc:
        status = "transformation_failed"
        failure_detail = {"stage": "apply_steps", "message": str(exc)[:500]}
        log(f"transformation failed: {exc}")
    except Exception as exc:  # noqa: BLE001 - surfaced as structured detail
        status = "infrastructure_failed"
        failure_detail = {"stage": "execute", "error_type": type(exc).__name__}
        log(f"execution failed: {type(exc).__name__}")

    log("reporting the structured result to Nomos")
    ack = request_json(
        f"{api_url}/api/v1/execution/jobs/{job_id}/result",
        method="POST",
        token=token,
        body={
            "executor": EXECUTOR_NAME,
            "executor_version": EXECUTOR_VERSION,
            "status": status,
            "changed_files": changed_files,
            "changed_lines": changed_lines,
            "checks": checks,
            "branch_pushed": branch_pushed,
            "head_commit": head_commit,
            "workflow_run_id": os.environ.get("GITHUB_RUN_ID"),
            "started_at": started_at.isoformat(),
            "completed_at": datetime.now(UTC).isoformat(),
            "failure_detail": failure_detail,
            "environment": {
                "runner_os": os.environ.get("RUNNER_OS"),
                "github_run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
            },
        },
    )

    decision = ack.get("decision", "unknown")
    log(f"Nomos decision: {decision}")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as handle:
            handle.write(f"decision={decision}\n")
            handle.write(f"changed-files={len(changed_files)}\n")

    # A non-zero exit only for our own failure to execute. A Nomos decision of
    # "human required" is a normal outcome, not a broken workflow run.
    return 1 if status not in {"succeeded"} else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ExecutorError as error:
        log(f"fatal: {error}")
        sys.exit(1)
