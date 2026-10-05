#!/bin/sh
# PH-SEC-WO-007 / exact-artifact binary + symbol presence.
# Read-only static inspection only. No network.
set -u

echo "=== [A] reverse dependencies: who requires these packages ==="
echo "--- packages depending on perl-base ---"
dpkg-query -W -f='${Package} ${Depends}\n' 2>/dev/null \
  | awk '$1!="perl-base" && $0 ~ /perl-base/ {print}' || true
echo "--- packages depending on libpcre2-8-0 ---"
dpkg-query -W -f='${Package} ${Depends}\n' 2>/dev/null \
  | awk '$1!="libpcre2-8-0" && $0 ~ /libpcre2-8-0/ {print}' || true
echo "--- packages depending on libstdc++6 ---"
dpkg-query -W -f='${Package} ${Depends}\n' 2>/dev/null \
  | awk '$1!="libstdc++6" && $0 ~ /libstdc\+\+6/ {print}' || true
echo "--- packages depending on zlib1g ---"
dpkg-query -W -f='${Package} ${Depends}\n' 2>/dev/null \
  | awk '$1!="zlib1g" && $0 ~ /zlib1g/ {print}' || true

echo
echo "=== [B] CVE-2026-12087 Socket.xs :: pack_ip_mreq_source XS symbol ==="
echo "--- Socket shared objects in image ---"
find / -name 'Socket.so' 2>/dev/null || echo "no Socket.so"
echo "--- is pack_ip_mreq_source callable? (autoload probe) ---"
perl -e 'my $ok = eval { require Socket; my $r = Socket::pack_ip_mreq_source("127.0.0.1","0.0.0.0",0); 1 }; print $ok ? "CALLABLE\n" : "NOT_CALLABLE: $@\n";' 2>&1 || true
echo "--- Socket version ---"
perl -MSocket -e 'print "Socket_VERSION=$Socket::VERSION\n"' 2>&1 || true

echo
echo "=== [C] CVE-2026-103111 pcre2 ==="
echo "--- libpcre2 files ---"
dpkg -L libpcre2-8-0 2>/dev/null | grep -E '\.so' || true
ls -l /usr/lib/x86_64-linux-gnu/libpcre2* 2>/dev/null || true
PCRELIB=$(ls /usr/lib/x86_64-linux-gnu/libpcre2-8.so.0 2>/dev/null | head -1)
echo "pcre2_lib=$PCRELIB"
if [ -n "$PCRELIB" ]; then
  echo "--- pcre2 JIT + version symbols present? ---"
  if command -v nm >/dev/null 2>&1; then
    nm -D --defined-only "$PCRELIB" 2>/dev/null | grep -Ei 'pcre2_(jit_compile|jit_match|jit_stack|version)' || echo "no jit/version symbols matched"
  else
    echo "nm unavailable"
  fi
  echo "--- pcre2_config / PCRE2 JIT availability via perl? ---"
  perl -e 'my $r = eval { require Socket; }; print "perl Socket ok\n";' 2>&1 || true
  echo "--- does anything in image link pcre2? ---"
  for b in /usr/bin/git /usr/bin/grep /usr/bin/sed /usr/bin/perl; do
    [ -e "$b" ] || continue
    if ldd "$b" 2>/dev/null | grep -q pcre2; then echo "LINKED: $b"; else echo "no-pcre2: $b"; fi
  done
fi
echo "--- pcre2 package version string ---"
strings /usr/lib/x86_64-linux-gnu/libpcre2-8.so.0 2>/dev/null | grep -E '^10\.4[0-9]' | head -3 || true

echo
echo "=== [D] CVE-2026-85091 zlib :: gz_vacate presence ==="
ZLIB=$(ls /usr/lib/x86_64-linux-gnu/libz.so.1 2>/dev/null | head -1)
echo "zlib_lib=$ZLIB"
if [ -n "$ZLIB" ]; then
  ls -l "$ZLIB"
  echo "--- zlib version ---"
  if command -v strings >/dev/null 2>&1; then
    strings "$ZLIB" | grep -E '^1\.[0-9]+\.[0-9]+' | head -5
  fi
  echo "--- gz_vacate / gzprintf / gzvprintf / gzwrite symbols ---"
  if command -v nm >/dev/null 2>&1; then
    echo "[gz_vacate]"; nm -D "$ZLIB" 2>/dev/null | grep -i gz_vacate || echo "  gz_vacate: ABSENT"
    echo "[gzwrite]";  nm -D "$ZLIB" 2>/dev/null | grep -i ' gzwrite$' || echo "  gzwrite: ABSENT"
    echo "[gzprintf]"; nm -D "$ZLIB" 2>/dev/null | grep -iE 'gzprintf|gzvprintf' || echo "  gzprintf/gzvprintf: ABSENT"
    echo "[inflate/deflate present = zlib sane]"; nm -D "$ZLIB" 2>/dev/null | grep -cE ' (inflate|deflate)$'
  else
    echo "nm unavailable"
  fi
fi

echo
echo "=== [E] CVE-2026-102010 / CVE-2026-95619 libstdc++ ==="
LS=$(ls /usr/lib/x86_64-linux-gnu/libstdc++.so.6* 2>/dev/null | head -1)
echo "libstdcxx=$LS"
if [ -n "$LS" ]; then
  ls -l "$LS"
  echo "--- erase_if / aligned new symbols ---"
  if command -v nm >/dev/null 2>&1; then
    echo "[erase_if]"; nm -D -C "$LS" 2>/dev/null | grep -i 'erase_if' || echo "  erase_if: ABSENT"
    echo "[aligned new / aligned_alloc]"; nm -D -C "$LS" 2>/dev/null | grep -E 'aligned_alloc|_ZdaPvSt11align_val|operator new' | head -10 || echo "  none matched"
  else
    echo "nm unavailable"
  fi
fi
echo "--- does the NODE binary link system libstdc++? ---"
NODEBIN=$(command -v node)
echo "node_bin=$NODEBIN"
ldd "$NODEBIN" 2>&1 | grep -Ei 'stdc|gcc_s' || echo "  node does NOT link system libstdc++/libgcc_s"
echo "--- full ldd of node ---"
ldd "$NODEBIN" 2>&1