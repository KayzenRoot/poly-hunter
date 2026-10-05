#!/bin/sh
# PH-SEC-WO-007 / perl component presence in the exact dev image.
# Read-only static inspection. No network. No writes outside /tmp.
set -u

echo "=== [1] perl executable presence ==="
if command -v perl >/dev/null 2>&1; then
  echo "perl_in_PATH=yes path=$(command -v perl)"
  perl -e 'printf("perl_version=%vd\n", $^V)' 2>/dev/null || true
else
  echo "perl_in_PATH=no"
fi
ls -l /usr/bin/perl /usr/bin/perl5* 2>/dev/null || echo "no /usr/bin/perl*"

echo
echo "=== [2] perl-base owned files that are perl modules (.pm) ==="
dpkg -L perl-base 2>/dev/null | grep -E '\.pm$' | sort || true
echo "--- perl-base module count ---"
dpkg -L perl-base 2>/dev/null | grep -cE '\.pm$'

echo
echo "=== [3] vulnerable-module presence (IO::Compress / IO::Uncompress / Pod::Text / Socket) ==="
for probe in \
  'IO/Compress.pm' \
  'IO/Compress/Zip.pm' \
  'IO/Uncompress/Unzip.pm' \
  'Pod/Text.pm' \
  'Socket.pm' \
  'Podlators.pm' \
  'ExtUtils/MakeMaker.pm' \
  'CPAN.pm' \
  'Data/Dumper.pm' \
  'Storable.pm' \
  'Encode.pm' \
  'JSON.pm' \
  'Term/ReadLine.pm'
do
  found=$(find / -path "*/perl*/$probe" -o -path "*/perl5/$probe" 2>/dev/null | head -1)
  if [ -n "$found" ]; then
    echo "PRESENT  $probe -> $found"
  else
    echo "ABSENT   $probe"
  fi
done

echo
echo "=== [4] total .pm module files anywhere in image ==="
find / -name '*.pm' 2>/dev/null | wc -l

echo
echo "=== [5] PERL5LIB / vendor dirs ==="
ls -d /usr/share/perl5 /usr/share/perl/5.36 /usr/lib/x86_64-linux-gnu/perl5 /usr/share/perl 2>/dev/null || true
echo "--- perl -V:@INC (if perl runnable) ---"
perl -e 'print join("\n",@INC),"\n"' 2>/dev/null || echo "perl not runnable"

echo
echo "=== [6] what pulls perl-base in (reverse dependency) ==="
dpkg-query -W -f='${Package} ${Depends}\n' 2>/dev/null | grep -F 'perl-base' || echo "no package Depends on perl-base"

echo
echo "=== [7] core perl C symbols relevant to CVE-2026-57432 / CVE-2026-13221 ==="
PERLBIN=$(command -v perl 2>/dev/null)
if [ -n "$PERLBIN" ]; then
  echo "perl_binary=$PERLBIN"
  ls -l "$PERLBIN"
  echo "--- static vs dynamic ---"
  if command -v ldd >/dev/null 2>&1; then ldd "$PERLBIN" 2>&1; else echo "ldd unavailable"; fi
  echo "--- perl binary buildinfo (perl -V) subset ---"
  perl -V:version -V:archname -V:ccflags 2>/dev/null || true
else
  echo "perl absent; cannot inspect symbols"
fi