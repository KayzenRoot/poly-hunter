#!/bin/sh
# PH-SEC-WO-007 / perl + util-linux + pcre2 reachability in the exact dev image.
# Read-only static inspection plus benign in-container probes only.
# No network. No exploit payloads. No writes outside /tmp.
set -u

echo "=== [1] Are there ANY perl scripts / perl invocations in the image? ==="
echo "--- files with perl shebang ---"
for f in $(find / -xdev -type f \( -name '*.pl' -o -name '*.pm' -o -name '*.t' \) 2>/dev/null | head -200); do
  head -c 2 "$f" 2>/dev/null | grep -q '#!' && head -1 "$f" | grep -qi perl && echo "PERL-SCRIPT: $f"
done
echo "--- dpkg files owned by any perl-ish package ---"
dpkg -l 2>/dev/null | awk '/^ii/ {print $2}' | grep -i perl || echo "(none)"
echo "--- perl-related dpkg packages installed ---"
dpkg-query -W -f='${Package} ${Version} ${Status}\n' 2>/dev/null | grep -i perl || echo "(no perl packages beyond perl-base)"

echo
echo "=== [2] Socket.pm : is pack_ip_mreq_source defined, and where does it come from? ==="
SOCKETPM=/usr/lib/x86_64-linux-gnu/perl-base/Socket.pm
if [ -f "$SOCKETPM" ]; then
  echo "socket_pm_sha256:"; sha256sum "$SOCKETPM"
  echo "--- grep for mreq symbols in Socket.pm ---"
  grep -n 'pack_ip_mreq\|pack_ip_mreq_source\|VERSION' "$SOCKETPM" | head -40
  echo "--- XS bootstrap section ---"
  grep -n 'boot_Socket\|DynaLoader\|XSLoader\|require' "$SOCKETPM" | head -20
else
  echo "Socket.pm not found at expected path"
fi

echo
echo "=== [3] Socket XS .so: does it carry pack_ip_mreq_source at all? ==="
SSO=/usr/lib/x86_64-linux-gnu/perl-base/auto/Socket/Socket.so
if [ -f "$SSO" ]; then
  sha256sum "$SSO"
  echo "--- printable strings mentioning mreq ---"
  if command -v strings >/dev/null 2>&1; then
    strings "$SSO" | grep -i mreq || echo "  no 'mreq' string in Socket.so"
  else
    echo "  (strings unavailable)"
  fi
fi

echo
echo "=== [4] Benign probe: what does Socket actually export to perl? ==="
perl -MSocket -e 'no strict; my @n = sort grep { /mreq|source/i } keys %Socket::; print join("\n",@n),"\n";' 2>&1 || true
echo "--- Socket version + full sub list count ---"
perl -MSocket -e 'printf("Socket::VERSION=%s\n", $Socket::VERSION); my @k=sort keys %Socket::; printf("subs=%d\n", scalar @k);' 2>&1 || true

echo
echo "=== [5] CVE-2026-76642 / 78408 / 78409 / 78410 util-linux: mount(8) + nsenter reachability ==="
echo "--- is /etc/fstab present and writable-by-nonroot relevant? ---"
ls -l /etc/fstab 2>/dev/null || echo "  no /etc/fstab in image"
echo "--- mount binary + nsenter binary presence ---"
for b in /usr/bin/mount /bin/mount /usr/bin/umount /usr/bin/nsenter /usr/bin/findmnt; do
  if [ -e "$b" ]; then echo "  PRESENT $b"; else echo "  ABSENT  $b"; fi
done
echo "--- does the image ship findmnt/mount helpers at all? ---"
dpkg -L util-linux 2>/dev/null | grep -E 'bin/(mount|umount|nsenter|findmnt|swapon|swapoff)$' || echo "  no such binaries in util-linux file list"
echo "--- can mount(8) be invoked unprivileged here? (benign: no fstab, no CAP_SYS_ADMIN) ---"
id
echo "--- capabilities of this probe process ---"
grep -E 'CapEff|CapBnd' /proc/self/status 2>/dev/null || echo "  (capability fields unavailable)"

echo
echo "=== [6] CVE-2026-103111 pcre2: which binaries link it, and do they use JIT? ==="
echo "--- every ELF in the image that links libpcre2 ---"
for b in $(find /usr/bin /bin /usr/sbin /sbin /usr/local/bin -xdev -type f 2>/dev/null); do
  if ldd "$b" 2>/dev/null | grep -q 'libpcre2-8'; then echo "  LINKS-PCRE2: $b"; fi
done
echo "--- does grep offer PCRE2 (-P) in this build? ---"
grep --version 2>/dev/null | head -2
if grep -P 'a' /dev/null 2>/dev/null; then echo "  grep -P supported"; else echo "  grep -P NOT supported"; fi
echo "--- grep PCRE2 library actually used ---"
ldd /usr/bin/grep 2>/dev/null | grep -E 'pcre|gnulib' || true

echo
echo "=== [7] Does the dev runtime actually execute perl/util-linux/pcre2? ==="
echo "--- node/npm presence and identity ---"
command -v node && node --version
command -v npm && npm --version
echo "--- is perl referenced by npm lifecycle config in this image? ---"
if [ -f /usr/local/lib/node_modules/npm/package.json ]; then
  echo "  npm_installed=yes"
else
  echo "  npm at: $(command -v npm) -> $(readlink -f "$(command -v npm)" 2>/dev/null)"
fi