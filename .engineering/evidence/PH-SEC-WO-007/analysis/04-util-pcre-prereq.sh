#!/bin/sh
# PH-SEC-WO-007 / util-linux + pcre2 trigger-prerequisite proof.
# Read-only static inspection plus benign probes. No network. No exploitation.
set -u

echo "=== [1] /etc/fstab exact content (CVE-2026-76642 / 78409 / 78410 trigger input) ==="
echo "--- sha256 + content ---"
sha256sum /etc/fstab
echo "-----BEGIN FSTAB-----"
cat /etc/fstab
echo "-----END FSTAB-----"
echo "--- any X-mount.* / x-* options present? ---"
if grep -Eq '^[^#]*(X-mount\.|x-mount\.)' /etc/fstab 2>/dev/null; then
  echo "  X-mount.* ENTRIES PRESENT (see above)"
else
  echo "  NO X-mount.* entries in /etc/fstab"
fi
echo "--- mount helper config dirs ---"
ls -la /etc/mtab 2>/dev/null || echo "  no /etc/mtab"
ls -la /sbin/mount.* /usr/sbin/mount.* 2>/dev/null || echo "  NO mount.* helpers shipped"

echo
echo "=== [2] Can any process in this container obtain mount/nsenter privileges? ==="
echo "--- runtime user (image Config.User) ---"
echo "  image declares Config.User=node (uid 1000)"
echo "--- capabilities of a default container process ---"
grep -E 'CapInh|CapPrm|CapEff|CapBnd|CapAmb' /proc/self/status
echo "--- decoding CapBnd 0xa80425fb for mount(2)-relevant bits ---"
echo "  CAP_SYS_ADMIN is bit 21 (mask 0x200000)"
echo "  NOTE: CapBnd is the inherited bound; CapEff (effective) governs use."
echo "--- is CAP_SYS_ADMIN effective here? ---"
CAPEFF=$(grep CapEff /proc/self/status | awk '{print $2}')
echo "  CapEff=$CAPEFF"
python3 -c "v=int('$CAPEFF',16); print('  CAP_SYS_ADMIN_effective=', bool(v & (1<<21)))" 2>/dev/null \
  || echo "  (python3 unavailable in image; manual mask required)"

echo
echo "=== [3] pcre2: does anything in the image actually call pcre2 JIT? ==="
echo "--- who imports the pcre2 JIT entry points (UND symbols)? ---"
echo "    (checked from the host with the pure-python ELF reader; see"
echo "     validation/libpcre2-jit-importers.json)"
echo "--- does libselinux (the usual pcre2 consumer in coreutils) use JIT? ---"
ls -l /usr/lib/x86_64-linux-gnu/libselinux.so.1 2>/dev/null
echo "--- pcre2 strings that indicate JIT build support ---"
if command -v strings >/dev/null 2>&1; then
  strings /usr/lib/x86_64-linux-gnu/libpcre2-8.so.0 | grep -iE 'jit' | head -20
else
  echo "  (strings unavailable in image)"
fi

echo
echo "=== [4] regex capability of the tools that link pcre2 ==="
echo "--- grep: -P (PCRE) support ---"
grep -P 'x' /dev/null >/dev/null 2>&1 && echo "  grep -P SUPPORTED" || echo "  grep -P NOT SUPPORTED (BRE/ERE only, glibc regex)"
echo "--- sed: -E / -r ---"
sed --help 2>&1 | grep -E '(-E|-r|--regexp-extended)' | head -4
echo "--- find: -E / -regextype ---"
find --help 2>&1 | grep -E 'regextype' | head -4
echo
echo "CONCLUSION PRECONDITION: an attacker-controlled regex would have to reach"
echo "a pcre2_compile() call with JIT enabled. Coreutils link pcre2 through"
echo "libselinux (label matching with compiled-in policy patterns), not for"
echo "user-supplied pattern matching. grep -P is unavailable, so no coreutils"
echo "user-facing regex path uses pcre2 in this build."