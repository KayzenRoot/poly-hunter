#!/usr/bin/env bash
# PH-M01-WO-004 audit CR-01 — deterministic harness gate.
#
# Proves, from the sources themselves, that the ephemeral test values (K1, K2,
# CANARY) and serialized keyring material can never enter a child process's
# argv or environment, never land in a file, and are consumed only from stdin.
#
# The gate runs a SELF-TEST first: a synthetic copy of the HISTORICAL offending
# pattern (`node -e '...' "$K1" "$K2" "$CANARY" "$1"`) must be DETECTED. A gate
# that has never been observed to fail is not evidence.
set -euo pipefail
cd "$(dirname "$0")"

scan_file() {
  local file="$1"
  local violations=0

  # Comment lines may describe the forbidden pattern (this file's own prose
  # names it on purpose), so the checks run over a comment-stripped copy.
  local subject
  subject="$(mktemp)"
  grep -vE '^[[:space:]]*#' "${file}" 2>/dev/null | grep -vE '^[[:space:]]*(//|\*|/\*)' > "${subject}" || true

  # 1. Ephemeral expansions only on: the assignments themselves, the printf
  #    payload builtin lines, and the final clearing line.
  local offenders
  offenders="$(grep -nE '\$(\{)?(K1|K2|CANARY)(\})?' "${subject}" \
    | grep -vE ':[[:space:]]*(K1=|K2=|CANARY=)' \
    | grep -vE 'printf ' || true)"
  if [[ -n "${offenders}" ]]; then
    echo "FAIL ${file}: ephemeral value expansion outside the assignments/printf payload:"
    printf '%s\n' "${offenders}"
    violations=1
  fi

  # 2. Never exported into the environment.
  if grep -nE '(^|[;&|(])[[:space:]]*export[[:space:]]+(K1|K2|CANARY)' "${subject}" >/dev/null; then
    echo "FAIL ${file}: exports an ephemeral value into the environment"
    violations=1
  fi

  # 3. Keyring material must not travel through `-e`/`--env` (only DATABASE_URL may).
  if grep -nE '(-e|--env)[^|]*\$(\{)?(K1|K2|CANARY|KEYRING)' "${subject}" >/dev/null; then
    echo "FAIL ${file}: passes ephemeral values through -e/--env"
    violations=1
  fi

  # 4. No child invocation receives an ephemeral value as an argument.
  if grep -nE "(node|-e|exec)[^|]*[[:space:]][\"']?\\\$(\{)?(K1|K2|CANARY)" "${subject}" >/dev/null; then
    echo "FAIL ${file}: ephemeral value appears as a command argument"
    violations=1
  fi

  # 5. Payloads are piped, never redirected into files.
  if grep -nE 'payload [a-z]+[[:space:]]*>' "${subject}" >/dev/null; then
    echo "FAIL ${file}: redirects a payload into a file"
    violations=1
  fi

  case "$(basename "${file}")" in
    drill-vault.mjs)
      if grep -niE 'argv[^,;]*(key|canary|keyring)' "${subject}" >/dev/null; then
        echo "FAIL ${file}: argv references key/canary/keyring material"
        violations=1
      fi
      if ! grep -q 'readFileSync(0' "${subject}"; then
        echo "FAIL ${file}: does not read its payload from stdin"
        violations=1
      fi
      ;;
    docker-probe.mjs)
      if ! grep -q 'randomBytes' "${subject}"; then
        echo "FAIL ${file}: expected in-process key generation (randomBytes)"
        violations=1
      fi
      if grep -nE 'readFileSync\(0' "${subject}" >/dev/null; then
        echo "FAIL ${file}: probe should not consume an external payload"
        violations=1
      fi
      ;;
  esac

  rm -f "${subject}"
  return "${violations}"
}

echo "== self-test: the historical offending pattern must be DETECTED =="
SELF_TEST_FILE="$(mktemp)"
cat > "${SELF_TEST_FILE}" <<'SELFTEST'
payload() {
  node -e '
    const [k1, k2] = process.argv.slice(1);
  ' "$K1" "$K2" "$CANARY" "$1"
}
export K1
SELFTEST
if scan_file "${SELF_TEST_FILE}"; then
  echo "SELF-TEST FAILED: the gate did not detect the historical pattern"
  rm -f "${SELF_TEST_FILE}"
  exit 1
fi
rm -f "${SELF_TEST_FILE}"
echo "self-test OK: the historical pattern is detected and rejected"

echo "== real harness files =="
overall=0
for f in recovery-rotation-drill.sh drill-vault.mjs docker-acceptance.sh docker-probe.mjs; do
  if scan_file "${f}"; then
    echo "PASS ${f}"
  else
    overall=1
  fi
done

if [[ "${overall}" -ne 0 ]]; then
  echo "harness gate: FAILED"
  exit 1
fi
echo "harness gate: PASS — ephemeral values travel through stdin pipes only"
