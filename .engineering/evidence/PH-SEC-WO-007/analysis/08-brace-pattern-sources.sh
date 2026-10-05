#!/bin/sh
# PH-SEC-WO-007 / brace-expansion decisive question:
# does a REGISTRY-CONTROLLED (untrusted) string ever reach minimatch ->
# braceExpand()? Trusted local manifest patterns are a different risk class.
set -u
NPM=/usr/local/lib/node_modules/npm

echo "=== [1] @tufjs/models role.js: where do its minimatch patterns come from? ==="
R=$NPM/node_modules/@tufjs/models/dist/role.js
if [ -f "$R" ]; then
  sed -n '1,80p' "$R" | sed 's/^/    /'
else
  echo "  MISSING $R"
fi

echo
echo "=== [2] who constructs the TUF role objects that feed role.js? ==="
grep -rln "tufjs/models\|@tufjs/models" "$NPM/lib" "$NPM/node_modules/@npmcli" 2>/dev/null | head -20
echo "--- tuf client entrypoint in npm ---"
find "$NPM/node_modules" -maxdepth 2 -type d -name 'tuf*' 2>/dev/null
echo "--- where does npm get TUF metadata from? ---"
grep -rn 'tuf\|TUF' "$NPM/lib/commands/signature.js" 2>/dev/null | head -20 || echo "  no signature.js"

echo
echo "=== [3] @npmcli/arborist release-age-exclude.js minimatch patterns ==="
F=$NPM/node_modules/@npmcli/arborist/lib/release-age-exclude.js
if [ -f "$F" ]; then
  cat "$F" | sed 's/^/    /' | head -80
else
  echo "  MISSING $F"
fi

echo
echo "=== [4] query-selector-all.js: what strings are matched? ==="
Q=$NPM/node_modules/@npmcli/arborist/lib/query-selector-all.js
if [ -f "$Q" ]; then
  grep -n 'minimatch' -B8 -A8 "$Q" | sed 's/^/    /'
fi

echo
echo "=== [5] map-workspaces: pattern source ==="
MW=$NPM/node_modules/@npmcli/map-workspaces/lib/index.js
if [ -f "$MW" ]; then
  grep -n 'minimatch\|workspaces' "$MW" | sed 's/^/    /' | head -25
fi

echo
echo "=== [6] Does npm enable TUF/signature verification in this image by default? ==="
echo "--- npm config ---"
npm config get signatures 2>/dev/null || true
npm config list 2>/dev/null | grep -iE 'signat|tuf|registry|provenance' || echo "  (no signature-related config)"
echo "--- .npmrc files in image ---"
for f in /usr/local/etc/npmrc /home/node/.npmrc /root/.npmrc; do
  [ -f "$f" ] && { echo "  --- $f"; cat "$f" | sed 's/^/      '; }
done
echo "  (end npmrc scan)"