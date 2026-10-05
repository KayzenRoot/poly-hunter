#!/bin/sh
# PH-SEC-WO-007 / npm-bundled finding inventory in the exact dev image.
# Distinguishes the package-manager execution path (npm's own bundled
# node_modules) from the application runtime path (workspace node_modules).
# Read-only static inspection. No network. No installs.
set -u

NPMROOT=$(dirname "$(dirname "$(readlink -f "$(command -v npm)")")")
echo "npm_real_path=$(readlink -f "$(command -v npm)")"
echo "npm_root=$NPMROOT"
echo "node=$(readlink -f "$(command -v node)")"
echo "npm_version=$(npm --version)"
echo "node_version=$(node --version)"
echo

TARGETS='brace-expansion undici tar ip-address http-cache-semantics'

echo "=== [1] Locate every installed copy of each target package ==="
for t in $TARGETS; do
  echo "--- $t ---"
  # npm's own bundled tree + workspace trees, excluding dev/proc noise
  find /usr/local/lib/node_modules /workspace -type d -name "$t" \
       -not -path '*/.next/*' 2>/dev/null | while read -r d; do
    if [ -f "$d/package.json" ]; then
      v=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$d/package.json" | head -1)
      echo "    $v  $d"
    fi
  done
done

echo
echo "=== [2] Exact version + integrity of each located copy (sha256 of package.json) ==="
for t in $TARGETS; do
  find /usr/local/lib/node_modules /workspace -type d -name "$t" \
       -not -path '*/.next/*' 2>/dev/null | while read -r d; do
    [ -f "$d/package.json" ] || continue
    echo "  --- $d"
    sed -n 's/^[[:space:]]*"\(name\|version\)"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/      \1: \2/p' "$d/package.json" | head -2
    sha256sum "$d/package.json"
  done
done

echo
echo "=== [3] brace-expansion: is the vulnerable code present in the shipped copy? ==="
BE=$(find /usr/local/lib/node_modules -type d -name brace-expansion 2>/dev/null | head -1)
if [ -n "$BE" ]; then
  echo "  dir=$BE"
  echo "  --- files ---"
  ls -l "$BE"
  echo "  --- package.json (full) ---"
  cat "$BE/package.json"
  echo "  --- EXPANSION_MAX_DEPTH present (CVE-2026-102278 fix marker)? ---"
  grep -rn 'EXPANSION_MAX_DEPTH' "$BE" 2>/dev/null || echo "    ABSENT"
  echo "  --- maxLength / EXPANSION_MAX_LENGTH present (CVE-2026-14257 fix marker)? ---"
  grep -rn 'EXPANSION_MAX_LENGTH\|maxLength' "$BE" 2>/dev/null | head -10 || echo "    ABSENT"
  echo "  --- push.apply present (CVE-2026-102276 vector 2 marker)? ---"
  grep -rn 'push.apply' "$BE" 2>/dev/null || echo "    ABSENT"
  echo "  --- parseCommaParts definition ---"
  grep -n 'parseCommaParts' "$BE"/*.js 2>/dev/null | head -10
  echo "  --- expand_ recursion sites ---"
  grep -n 'function expand_\|expand_(' "$BE"/*.js 2>/dev/null | head -20
  echo "  --- sha256 of implementation file(s) ---"
  sha256sum "$BE"/*.js 2>/dev/null
else
  echo "  brace-expansion NOT FOUND under npm's bundled tree"
fi

echo
echo "=== [4] tar: mapHas / filesFilter present? (CVE-2026-73566) ==="
TAR=$(find /usr/local/lib/node_modules -type d -path '*tar' -name tar 2>/dev/null | head -1)
echo "  dir=${TAR:-<not found>}"
if [ -n "$TAR" ]; then
  grep -rn 'mapHas' "$TAR" 2>/dev/null | head -10 || echo "    mapHas ABSENT"
  echo "  --- version ---"
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/    \1/p' "$TAR/package.json" | head -1
fi

echo
echo "=== [5] undici: WebSocket client present? (CVE-2026-19534) ==="
UN=$(find /usr/local/lib/node_modules -type d -name undici 2>/dev/null | head -1)
echo "  dir=${UN:-<not found>}"
if [ -n "$UN" ]; then
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/    version: \1/p' "$UN/package.json" | head -1
  echo "  --- WebSocket implementation files ---"
  ls "$UN/lib/web/websocket" 2>/dev/null || echo "    no lib/web/websocket dir"
  echo "  --- does npm depend on undici at all? ---"
  NPMJSON=/usr/local/lib/node_modules/npm/package.json
  grep -n '"undici"' "$NPMJSON" 2>/dev/null || echo "    npm does not declare undici"
  echo "  --- who requires undici inside npm? ---"
  grep -rln "require('undici')\|require(\"undici\")\|from 'undici'" /usr/local/lib/node_modules/npm 2>/dev/null | head -10 || echo "    no undici import found in npm tree"
fi

echo
echo "=== [6] ip-address / http-cache-semantics: importers inside npm ==="
for t in ip-address http-cache-semantics; do
  echo "--- $t ---"
  grep -rln "require('$t')\|require(\"$t\")\|from '$t'" /usr/local/lib/node_modules/npm 2>/dev/null | head -10 || echo "    no importer in npm tree"
done
echo
echo "=== [7] does npm's bundled tree declare brace-expansion / tar? ==="
grep -nE '"(brace-expansion|tar|ip-address|http-cache-semantics|undici|minimatch|pacote|make-fetch-happen)"' /usr/local/lib/node_modules/npm/package.json 2>/dev/null | head -20