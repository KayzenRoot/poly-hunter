#!/bin/sh
# PH-SEC-WO-007 / importer-behaviour proof for the npm-bundled findings.
# For each finding this records whether the vulnerable API is actually invoked
# by the identified importer, and what the input source is.
# Read-only static inspection. No network. No installs. No exploit payloads.
set -u
NPM=/usr/local/lib/node_modules/npm

echo "=== [1] brace-expansion 5.0.7: who calls expand(), and from where? ==="
echo "--- direct importers of brace-expansion inside npm ---"
grep -rln "brace-expansion" $NPM --include=*.js 2>/dev/null | grep -v '/brace-expansion/' | grep -v '/docs/' | head -20
echo "--- minimatch's use of braceExpansion ---"
MM=$(find $NPM -type d -name minimatch 2>/dev/null | head -1)
echo "  minimatch_dir=$MM"
if [ -n "$MM" ]; then
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/    minimatch_version: \1/p' "$MM/package.json" | head -1
  grep -rn 'braceExpansion\|brace-expansion' "$MM/dist" 2>/dev/null | head -10
  echo "  --- MAX_PATTERN_LENGTH in minimatch ---"
  grep -rn 'MAX_PATTERN_LENGTH' "$MM/dist" 2>/dev/null | head -5
fi
echo "--- npm files that call minimatch ---"
grep -rln "require('minimatch')\|require(\"minimatch\")\|from 'minimatch'" $NPM --include=*.js 2>/dev/null | grep -v '/docs/' | head -20

echo
echo "=== [2] CVE-2026-73566 tar mapHas: does npm pass a MEMBER SELECTION LIST? ==="
echo "--- every tar.t / tar.x call site in npm ---"
grep -rn 'tar\.t(\|tar\.x(\|tar\.list(\|tar\.extract(' $NPM --include=*.js 2>/dev/null | grep -v '/docs/' | head -30
echo "--- pacote's tar usage (the real extraction path) ---"
PAC=$(find $NPM -type d -name pacote 2>/dev/null | head -1)
echo "  pacote_dir=$PAC"
if [ -n "$PAC" ]; then
  grep -rn 'tar\.\(x\|t\|extract\|list\)' "$PAC/dist" 2>/dev/null | head -20
fi
echo "--- tar 7.5.19 filesFilter install site (the guard the CVE requires to be bypassed) ---"
sed -n '50,90p' $NPM/node_modules/tar/dist/commonjs/list.js

echo
echo "=== [3] CVE-2026-19534 undici WebSocket: does any importer use WebSocket? ==="
echo "--- undici importers inside npm (js only, no docs) ---"
grep -rln "require('undici')\|require(\"undici\")" $NPM --include=*.js 2>/dev/null | grep -v '/docs/' | head -20
echo "--- node-gyp download.js: which undici APIs does it use? ---"
NG=$NPM/node_modules/node-gyp/lib/download.js
if [ -f "$NG" ]; then
  grep -n 'undici\|WebSocket\|request\|fetch' "$NG" | head -20
fi
echo "--- ANY WebSocket usage anywhere in npm ---"
grep -rn 'WebSocket' $NPM --include=*.js 2>/dev/null | grep -v '/undici/' | grep -v '/docs/' | head -20 || echo "  none outside undici itself"

echo
echo "=== [4] CVE-2026-69192 ip-address: which classifier APIs does socks call? ==="
SOCKS=$(find $NMP $NPM -maxdepth 2 -type d -name socks 2>/dev/null | head -1)
echo "  socks_dir=$SOCKS"
for f in "$SOCKS/build/common/helpers.js" "$SOCKS/build/client/socksclient.js"; do
  [ -f "$f" ] || continue
  echo "  --- $f"
  grep -n 'ip-address\|Address4\|Address6\|isPrivate\|isLoopback\|isInSubnet\|isValid\|correctForm\|isLinkLocal\|isCGNAT' "$f" | head -25
done

echo
echo "=== [5] CVE-2026-93748 http-cache-semantics: does npm run a SHARED cache honouring max-stale? ==="
echo "--- make-fetch-happen policy.js: cache-zeroing + max-stale handling ---"
MFH=$NPM/node_modules/make-fetch-happen/lib/cache/policy.js
if [ -f "$MFH" ]; then
  grep -n 'max-stale\|maxStale\|stale\|rescale\|satisfiesWithoutRevalidation\|_isShared\|private\|no-store' "$MFH" | head -30
fi
echo "--- make-fetch-happen cache directory ownership / sharing model ---"
grep -rn 'cachePath\|cache.*path\|CACHE' $NPM/node_modules/make-fetch-happen/lib/cache/index.js 2>/dev/null | head -15
echo "--- does npm ever send a max-stale request header? ---"
grep -rn "max-stale" $NPM --include=*.js 2>/dev/null | grep -v '/docs/' | grep -v 'http-cache-semantics/' | head -10 || echo "  npm never emits max-stale"

echo
echo "=== [6] Application tree: is any of these in the APP runtime path? ==="
echo "--- app brace-expansion version ---"
sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/  \1/p' /workspace/node_modules/brace-expansion/package.json 2>/dev/null | head -1
echo "--- app-side copies of undici/ip-address/http-cache-semantics ---"
for t in undici ip-address http-cache-semantics; do
  echo "  $t:"
  find /workspace/node_modules /workspace/apps -maxdepth 4 -type d -name "$t" -not -path '*/.next/*' 2>/dev/null | head -5
done
echo "--- does the app import minimatch/glob/brace-expansion? ---"
grep -rln "minimatch\|brace-expansion\|from 'glob'" /workspace/apps /workspace/packages --include=*.ts --include=*.tsx --include=*.js 2>/dev/null | grep -v node_modules | head -10 || echo "  no app import of minimatch/glob/brace-expansion"