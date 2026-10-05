#!/usr/bin/env python3
"""Regenerate .engineering/evidence/PH-SEC-WO-007/SHA256SUMS.txt.

Hashes are computed over the COMMITTED (git blob) bytes of every tracked file
under .engineering/evidence/PH-SEC-WO-007/, excluding the index itself, so the
index verifies against repository content rather than a platform-specific
working tree. .engineering/evidence/.gitattributes pins eol=lf for this bundle to
keep that stable.

Because the hashes come from the git index, run this AFTER `git add` of the
files being indexed. It is idempotent and deterministic: same staged content =>
byte-identical index.

    git add -A
    python .engineering/evidence/PH-SEC-WO-007/analysis/10-sha256sums.py
    git add .engineering/evidence/PH-SEC-WO-007/SHA256SUMS.txt
"""

from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

BUNDLE = ".engineering/evidence/PH-SEC-WO-007"
INDEX = f"{BUNDLE}/SHA256SUMS.txt"
REPO = Path(__file__).resolve().parents[4]

HEADER = f"""# PH-SEC-WO-007 evidence bundle - SHA-256 index
#
# Hashes are computed over the COMMITTED (git blob) bytes of every file under
# {BUNDLE}/, so this index verifies against the
# repository content rather than a platform-specific working tree.
# .gitattributes pins eol=lf for this bundle to keep that stable.
#
# Regenerate deterministically with:
#   git add -A && python {BUNDLE}/analysis/10-sha256sums.py
#
# Verify from the repository root:
#   git ls-files -z {BUNDLE} | xargs -0 sha256sum -c {INDEX}
#
# Target artifact: polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3
# Locked SARIF blob: d3999a5664ec91e2b555d468b6e85c8d04aaabe9
# Parent exact head: 7d5be250255bd20cb0b20d6713f6f41c52c73b47
#
# analysis/*.py and analysis/*.sh are the deterministic, re-runnable scripts
# that produced these receipts; they are part of the auditable bundle.
#
"""


def git_bytes(*args: str) -> bytes:
    return subprocess.run(
        ["git", *args], cwd=REPO, capture_output=True, check=True
    ).stdout


def main() -> int:
    tracked = git_bytes("ls-files", "-z", "--", BUNDLE).decode().split("\0")
    paths = sorted(p for p in tracked if p and p != INDEX)
    if not paths:
        print("no tracked files under the bundle; stage them first", file=sys.stderr)
        return 1

    lines = []
    for path in paths:
        blob = git_bytes("cat-file", "blob", f":{path}")
        lines.append(f"{hashlib.sha256(blob).hexdigest()}  {path}")

    out = HEADER + "\n".join(lines) + "\n"
    target = REPO / INDEX
    previous = target.read_text(encoding="utf-8") if target.is_file() else None
    target.write_bytes(out.encode("utf-8"))

    added = [p for p in paths if previous is None or p not in previous]
    print(f"indexed {len(paths)} files -> {INDEX}")
    if added:
        print("newly indexed:")
        for p in added:
            print(f"  + {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
