#!/bin/sh
set +e
mkdir -p .engineering/evidence/PH-SEC-WO-006/validation/C
run_gate() {
  gate="$1"
  shift
  printf 'START %s\n' "$gate"
  "$@" > ".engineering/evidence/PH-SEC-WO-006/validation/C/${gate}.log" 2>&1
  rc=$?
  printf '%s=%s\n' "$gate" "$rc" | tee -a .engineering/evidence/PH-SEC-WO-006/validation/C/results.txt
}
: > .engineering/evidence/PH-SEC-WO-006/validation/C/results.txt
run_gate npm-ci npm ci
run_gate lint npm run lint
run_gate format-check npm run format:check
run_gate typecheck npm run typecheck
run_gate test npm test
run_gate build npm run build
run_gate npm-audit npm audit --audit-level=high
run_gate validate npm run validate