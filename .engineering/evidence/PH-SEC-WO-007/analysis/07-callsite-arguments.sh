#!/bin/sh
# PH-SEC-WO-007 / focused follow-up: exact call-site arguments.
# CVE-2026-73566 needs a MEMBER SELECTION LIST; CVE-2026-69192 needs an
# ip-address CLASSIFIER used as a trust decision.
set -u
NPM=/usr/local/lib/node_modules/npm

echo "=== [A] CVE-2026-73566 tar: every call site with 20 lines of context ==="
for spec in \
  "$NPM/lib/utils/tar.js:57" \
  "$NPM/lib/commands/stage/download.js:48" \
  "$NPM/node_modules/libnpmdiff/lib/untar.js:11" \
  "$NPM/node_modules/node-gyp/lib/install.js:211" \
  "$NPM/node_modules/node-gyp/lib/install.js:234" \
  "$NPM/node_modules/pacote/lib/fetcher.js:385" ; do
  f=${spec%:*}; l=${spec##*:}
  echo "----- $f : line $l -----"
  if [ -f "$f" ]; then
    start=$((l-12)); [ "$start" -lt 1 ] && start=1
    end=$((l+14))
    sed -n "${start},${end}p" "$f" | sed 's/^/    /'
  else
    echo "    FILE MISSING"
  fi
done

echo
echo "=== [B] CVE-2026-73566: does ANY call site pass a files/member array? ==="
echo "--- tar.x / tar.t / tar.extract / tar.list sites that also mention 'files' in the option object ---"
grep -rn -A12 'tar\.\(x\|t\|extract\|list\)({' $NPM --include=*.js 2>/dev/null | grep -v '/docs/' | grep -E 'files\s*:' | head -20 || echo "  no 'files:' option found adjacent to any tar call site"
echo "--- node-tar API: when is filesFilter installed? ---"
grep -n 'filesFilter\|opt.files\|files)' $NPM/node_modules/tar/dist/commonjs/list.js | head -20
echo "--- node-tar extract: when is filesFilter installed? ---"
grep -n 'filesFilter\|opt.files' $NPM/node_modules/tar/dist/commonjs/extract.js | head -20
echo "--- node-tar list: when is filesFilter installed? ---"
grep -n 'filesFilter\|opt.files\|files' $NPM/node_modules/tar/dist/commonjs/list.js | head -20

echo
echo "=== [C] CVE-2026-69192 ip-address: what does socks actually call? ==="
SOCKS="$NPM/node_modules/socks"
echo "  socks_dir=$SOCKS  exists=$([ -d "$SOCKS" ] && echo yes || echo no)"
if [ -d "$SOCKS" ]; then
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/    socks_version: \1/p' "$SOCKS/package.json" | head -1
  echo "--- every ip-address API reference in socks ---"
  grep -rn "ip-address\|Address4\|Address6" "$SOCKS/build" 2>/dev/null | head -30
  echo "--- every classifier call (isPrivate/isLoopback/isInSubnet/isValid/correctForm/...) ---"
  grep -rn 'isPrivate\|isLoopback\|isLinkLocal\|isCGNAT\|isInSubnet\|isHostInSubnet\|isValid\|correctForm\|Address4\|Address6' "$SOCKS/build" 2>/dev/null | head -40
fi

echo
echo "=== [D] CVE-2026-93748 http-cache-semantics: is npm's cache shared/multi-user? ==="
echo "--- make-fetch-happen cache index: cachePath default + ownership ---"
sed -n '30,60p' "$NPM/node_modules/make-fetch-happen/lib/cache/index.js" 2>/dev/null
echo "--- npm cache location in image ---"
echo "  npm_config_cache default: $(npm config get cache 2>/dev/null)"
echo "--- who owns it / is it per-user ---"
ls -ld "$(npm config get cache 2>/dev/null)" 2>/dev/null || echo "  (cache dir not created in image)"
echo "--- does npm run any HTTP proxy/cache server? ---"
grep -rn 'createServer\|http.createServer' "$NPM/lib" 2>/dev/null | head -5 || echo "  npm does not create an HTTP server in lib/"

echo
echo "=== [E] brace-expansion: pattern SOURCES reaching npm minimatch ==="
echo "--- get-workspaces.js (workspaces field = local repo manifest) ---"
grep -n 'minimatch\|workspaces' "$NPM/lib/utils/get-workspaces.js" 2>/dev/null | head -20
echo "--- ignore-walk (used by npm pack; files field = local repo manifest) ---"
grep -n 'minimatch\|walk\|pkg.files\|npmignore' "$NPM/node_modules/ignore-walk/lib/index.js" 2>/dev/null | head -20
echo "--- arborist query-selector-all (workspace selection) ---"
grep -n 'minimatch' "$NPM/node_modules/@npmcli/arborist/lib/query-selector-all.js" 2>/dev/null | head -10