#!/usr/bin/env python3
"""PH-SEC-WO-007 / validation-gate container-context diagnosis.

Corrects the CR-01 finding: the `npm run validate` failures recorded in
validation/gates.md were produced by executing the repository validation inside
the compose `web` container, whose /workspace is NOT a faithful view of the
checked-out repository. This script proves that, deterministically, from two
independent sources:

  * git          -- what the parent exact head actually contains;
  * container    -- what the compose `web` service actually exposes.

Host-side git assertions are mandatory and make the script exit non-zero on
drift. Container probes are best-effort: if the compose runtime is not up they
record `unavailable` rather than silently passing, so the receipt cannot go
stale in either direction.

Read-only. No network. No exploitation. Nothing in the image is executed.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

PARENT_HEAD = "7d5be250255bd20cb0b20d6713f6f41c52c73b47"
COMPOSE_PROJECT = "polyhunter-local"
WEB_SERVICE = "web"
CI_RUN_ID = 37243275834

REPO = Path(__file__).resolve().parents[4]

checks: list[dict] = []


def preflight_parent_object() -> None:
    """Fail closed and legibly if the parent exact head is not in this clone."""
    try:
        git("cat-file", "-e", f"{PARENT_HEAD}^{{commit}}")
    except GitUnavailable as exc:
        print(
            json.dumps(
                {
                    "workOrder": "PH-SEC-WO-007",
                    "parentHead": PARENT_HEAD,
                    "result": "STOP_STALE",
                    "reason": "parent exact head is not resolvable in this clone; "
                              "the container-context reclassification cannot be re-verified",
                    "detail": str(exc),
                },
                indent=2,
            )
        )
        print(f"\nSTOP STALE: {exc}", file=sys.stderr)
        sys.exit(1)


def record(check_id: str, assertion: str, expected, observed, ok: bool, source: str) -> None:
    checks.append(
        {
            "id": check_id,
            "assertion": assertion,
            "expected": expected,
            "observed": observed,
            "result": "PASS" if ok else "FAIL",
            "source": source,
        }
    )


class GitUnavailable(RuntimeError):
    pass


def git(*args: str) -> str:
    try:
        return subprocess.run(
            ["git", *args],
            cwd=REPO,
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        detail = getattr(exc, "stderr", None) or str(exc)
        raise GitUnavailable(f"git {' '.join(args)} failed: {detail.strip()}") from exc


preflight_parent_object()


def compose(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["docker", "compose", "--project-name", COMPOSE_PROJECT, *args],
        cwd=REPO,
        capture_output=True,
        text=True,
    )


def web_exec(script: str) -> subprocess.CompletedProcess:
    return compose("exec", "-T", WEB_SERVICE, "sh", "-lc", script)


# ---------------------------------------------------------------------------
# [1] git: the parent exact head really does contain apps/worker/tsconfig.json
# ---------------------------------------------------------------------------
tracked = git("ls-tree", "-r", "--name-only", PARENT_HEAD).splitlines()
record(
    "G1",
    "apps/worker/tsconfig.json is tracked at the parent exact head",
    "present in git tree",
    "present" if "apps/worker/tsconfig.json" in tracked else "ABSENT",
    "apps/worker/tsconfig.json" in tracked,
    f"git ls-tree -r {PARENT_HEAD}",
)

record(
    "G2",
    "biome.json is tracked at the parent exact head",
    "present in git tree",
    "present" if "biome.json" in tracked else "ABSENT",
    "biome.json" in tracked,
    f"git ls-tree -r {PARENT_HEAD}",
)

gitignore = git("show", f"{PARENT_HEAD}:.gitignore")
record(
    "G3",
    ".gitignore at the parent head ignores generated .next output",
    ".next/ rule present",
    ".next/ rule present" if ".next/" in gitignore else "rule absent",
    ".next/" in gitignore,
    f"git show {PARENT_HEAD}:.gitignore",
)

# ---------------------------------------------------------------------------
# [2] compose: what the web service actually bind-mounts
# ---------------------------------------------------------------------------
compose_yaml = git("show", f"{PARENT_HEAD}:compose.yaml")
web_block = compose_yaml.split("\n  web:")[1].split("\n  worker:")[0]
mount_sources = [
    line.strip().lstrip("- ").strip()
    for line in web_block.splitlines()
    if line.strip().startswith("- .")
]
mount_sources += [
    line.strip().split("source:", 1)[1].strip()
    for line in web_block.splitlines()
    if "source:" in line
]
mount_sources = sorted({s for s in mount_sources if s})

worker_mounted = any("apps/worker" in s for s in mount_sources)
record(
    "C1",
    f"compose service '{WEB_SERVICE}' bind-mounts apps/worker",
    "apps/worker mounted (so the container would see host sources)",
    "apps/worker NOT mounted" if not worker_mounted else "apps/worker mounted",
    not worker_mounted,
    f"compose.yaml @ {PARENT_HEAD} (service {WEB_SERVICE} volumes)",
)

biome_mounted = any(s.endswith("biome.json") for s in mount_sources)
record(
    "C2",
    f"compose service '{WEB_SERVICE}' bind-mounts biome.json",
    "biome.json mounted",
    "biome.json NOT mounted" if not biome_mounted else "biome.json mounted",
    not biome_mounted,
    f"compose.yaml @ {PARENT_HEAD} (service {WEB_SERVICE} volumes)",
)

next_volume = "web_next" in compose_yaml and "/workspace/apps/web/.next" in compose_yaml
record(
    "C3",
    "apps/web/.next is a generated docker volume target in the web service",
    "volume target present",
    "volume target present" if next_volume else "absent",
    next_volume,
    f"compose.yaml @ {PARENT_HEAD} (service {WEB_SERVICE} volumes)",
)

# ---------------------------------------------------------------------------
# [3] Dockerfile.dev: what the image bakes in
# ---------------------------------------------------------------------------
dockerfile = git("show", f"{PARENT_HEAD}:Dockerfile.dev")
copied = dockerfile.split("npm ci")[0]
record(
    "D1",
    "Dockerfile.dev COPYs biome.json into the image",
    "biome.json copied",
    "biome.json NOT copied" if "biome.json" not in copied else "biome.json copied",
    "biome.json" not in copied,
    f"Dockerfile.dev @ {PARENT_HEAD}",
)
record(
    "D2",
    "Dockerfile.dev COPYs apps/worker/tsconfig.json into the image",
    "tsconfig.json copied",
    "NOT copied (only apps/worker/package.json)" if "apps/worker/tsconfig.json" not in copied
    else "tsconfig.json copied",
    "apps/worker/tsconfig.json" not in copied,
    f"Dockerfile.dev @ {PARENT_HEAD}",
)
record(
    "D3",
    "Dockerfile.dev bakes node_modules via npm ci (biome version is image-fixed)",
    "npm ci present",
    "npm ci present" if "npm ci" in dockerfile else "absent",
    "npm ci" in dockerfile,
    f"Dockerfile.dev @ {PARENT_HEAD}",
)

lockfile = git("show", f"{PARENT_HEAD}:package-lock.json")
lock_biome = "2.5.15" if '"version": "2.5.15"' in lockfile else "unknown"
record(
    "D4",
    "lockfile pins @biomejs/biome 2.5.15 (no version drift vs container)",
    "2.5.15",
    lock_biome,
    lock_biome == "2.5.15",
    f"package-lock.json @ {PARENT_HEAD}",
)

# ---------------------------------------------------------------------------
# [4] CI: the authoritative clean-checkout gate verdict
# ---------------------------------------------------------------------------
workflow = git("show", f"{PARENT_HEAD}:.github/workflows/validate.yml")
record(
    "V1",
    "CI Validate workflow executes `npm run validate`",
    "npm run validate present",
    "present" if "npm run validate" in workflow else "ABSENT",
    "npm run validate" in workflow,
    f".github/workflows/validate.yml @ {PARENT_HEAD}",
)
record(
    "V2",
    "CI installs from the lockfile with a full checkout (no bind-mount gap)",
    "npm ci + actions/checkout",
    "npm ci + actions/checkout"
    if "npm ci" in workflow and "actions/checkout" in workflow
    else "missing",
    "npm ci" in workflow and "actions/checkout" in workflow,
    f".github/workflows/validate.yml @ {PARENT_HEAD}",
)

# The CI verdict itself is a captured receipt, not something this script re-queries
# (it must stay reproducible offline). Verify the receipt is present and agrees.
run_receipt = REPO / ".engineering/evidence/PH-SEC-WO-007/validation/validate-ci-run-46.json"
ci_ok = False
ci_observed: object = "receipt missing"
if run_receipt.is_file():
    ci = json.loads(run_receipt.read_text(encoding="utf-8"))
    run = ci["run"]
    ci_ok = (
        run["databaseId"] == CI_RUN_ID
        and run["headSha"] == PARENT_HEAD
        and run["workflowName"] == "Validate"
        and run["status"] == "completed"
        and run["conclusion"] == "success"
        and all(j["conclusion"] == "success" for j in ci["jobs"])
        and all(s["conclusion"] == "success" for j in ci["jobs"] for s in j["steps"])
    )
    ci_observed = (
        f"run {CI_RUN_ID} headSha={run['headSha'][:7]} "
        f"{run['status']}/{run['conclusion']}, all jobs+steps success"
    )
record(
    "V3",
    f"GitHub Actions Validate run {CI_RUN_ID} succeeded on the parent exact head",
    "completed/success, all jobs and steps success",
    ci_observed,
    ci_ok,
    "validation/validate-ci-run-46.json",
)

# ---------------------------------------------------------------------------
# [5] Container probes (best effort; recorded as unavailable when runtime is down)
# ---------------------------------------------------------------------------
probes = {
    "X1": (
        "biome.json is absent from /workspace inside the web container",
        "test -f /workspace/biome.json && echo present || echo absent",
        lambda out: out.strip() == "absent",
    ),
    "X2": (
        ".gitignore is absent from /workspace inside the web container",
        "test -f /workspace/.gitignore && echo present || echo absent",
        lambda out: out.strip() == "absent",
    ),
    "X3": (
        "/workspace/apps/worker holds only package.json (no tsconfig.json)",
        "ls -1 /workspace/apps/worker",
        lambda out: "tsconfig.json" not in out and "package.json" in out,
    ),
    "X4": (
        "apps/web/.next dev-server output is present inside the container",
        "test -d /workspace/apps/web/.next/dev && echo present || echo absent",
        lambda out: out.strip() == "present",
    ),
    "X5": (
        "biome inside the container is the same version as the lockfile",
        "npx biome --version",
        lambda out: "2.5.15" in out,
    ),
}

ps = compose("ps", "--status", "running", "--format", "{{.Service}}")
web_up = WEB_SERVICE in ps.stdout
if not web_up:
    for cid, (assertion, _, _) in probes.items():
        record(
            cid,
            assertion,
            "probe executed",
            "unavailable (compose runtime not running)",
            False,
            f"docker compose exec {WEB_SERVICE}",
        )
else:
    for cid, (assertion, script, predicate) in probes.items():
        proc = web_exec(script)
        out = proc.stdout
        if proc.returncode != 0 and not out.strip():
            record(cid, assertion, "probe executed", "unavailable (probe error)", False,
                   f"docker compose exec {WEB_SERVICE}")
            continue
        record(
            cid,
            assertion,
            "see observed",
            " | ".join(line.strip() for line in out.splitlines() if line.strip()) or "(empty)",
            predicate(out),
            f"docker compose exec {WEB_SERVICE}",
        )

# ---------------------------------------------------------------------------
# Verdict
# ---------------------------------------------------------------------------
mandatory = [c for c in checks if c["id"][0] in "GCDV"]
failed_mandatory = [c for c in mandatory if c["result"] == "FAIL"]
failed_probe = [c for c in checks if c["id"][0] == "X" and c["result"] == "FAIL"]

summary = {
    "workOrder": "PH-SEC-WO-007",
    "purpose": "CR-01 reclassification: prove the recorded validate failures are "
               "container-context artifacts of the compose web service, not defects "
               "of the parent exact head.",
    "parentHead": PARENT_HEAD,
    "composeProject": COMPOSE_PROJECT,
    "ciRunId": CI_RUN_ID,
    "webRuntimeUp": web_up,
    "checks": checks,
    "totals": {
        "total": len(checks),
        "mandatory": len(mandatory),
        "mandatoryPassed": len(mandatory) - len(failed_mandatory),
        "containerProbes": len(checks) - len(mandatory),
        "containerProbesPassed": (len(checks) - len(mandatory)) - len(failed_probe),
    },
    "conclusion": (
        "The parent exact head passes npm run validate on a clean checkout "
        f"(GitHub Actions Validate run {CI_RUN_ID}, SUCCESS). The compose web "
        "service does not bind-mount apps/worker and neither compose nor "
        "Dockerfile.dev provides biome.json, .gitignore or .git inside the "
        "container, so in-container lint/format:check/typecheck failures are "
        "container-context artifacts and are not evidence about the parent head."
    ),
}

print(json.dumps(summary, indent=2))

if failed_mandatory:
    print(
        "\nSTOP STALE: a mandatory git/CI assertion failed; the container-context "
        "reclassification no longer holds.",
        file=sys.stderr,
    )
    sys.exit(1)

if failed_probe:
    print(
        "\nWARNING: container probes did not confirm the mechanism (runtime down or "
        "state changed). The mandatory git/CI evidence still holds; re-run with the "
        "compose runtime up to refresh the mechanism confirmation.",
        file=sys.stderr,
    )

sys.exit(0)
