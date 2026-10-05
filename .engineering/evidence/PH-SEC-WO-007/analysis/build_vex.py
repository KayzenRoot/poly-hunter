#!/usr/bin/env python3
"""PH-SEC-WO-007 / build the machine-readable VEX record.

Every row is individual: one CVE, one component, one disposition, with the
exact-artifact evidence that supports it. Nothing is grouped.

Per ADR-0007 and PH-SEC-VEX-POLICY this script only ever PROPOSES a
disposition. independentAuditor and ownerApproval are emitted as PENDING and
no row is approved here.
"""

import json
import sys
from pathlib import Path

ROOT = Path(".engineering/evidence/PH-SEC-WO-007")
IMAGE = "polyhunter-dev:local"
DIGEST = ("sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3")
SCANNER = "docker scout 1.24.0"
SARIF = (".engineering/evidence/PH-SEC-WO-005/validation/CR-01/"
         "polyhunter-dev-cr01.sarif")
DISPOSITION_TS = "2026-10-05T12:42:46Z"

# Evidence receipt keys under PH-SEC-WO-007/
R_SARIF = "preflight/preflight-reconciliation.json"
R_SYMPRES = "validation/symbol-presence-authoritative.json"
R_PERL = "validation/perl-component-presence.txt"
R_PERLREACH = "validation/perl-util-pcre-reachability.txt"
R_UTIL = "validation/util-pcre-prerequisites.txt"
R_PCRE = "validation/libpcre2-jit-importers.json"
R_GREPP = "validation/grep-pcre2-support.txt"
R_NPMINV = "validation/npm-bundled-inventory.txt"
R_NPMIMP = "validation/npm-importer-behaviour.txt"
R_CALLS = "validation/callsite-arguments.txt"
R_BRACE = "validation/brace-pattern-sources.txt"
R_DPKG = "validation/image-dpkg-inventory.txt"
R_IDENT = "validation/image-identity.txt"

EXPIRY_7D = ("Expires at the earliest of 7 days from disposition, a new image "
             "digest, a new scanner result changing component/version, a new "
             "vendor/upstream advisory, a KEV status change, a material "
             "architecture/exposure change, or evidence becoming stale. "
             "Expired disposition returns to UNDER_INVESTIGATION automatically.")

RUNTIME = {
    "environment": "local-dev",
    "compose_services": ["web", "worker", "postgres"],
    "web_command": ("npm run dev --workspace @polyhunter/web -- --webpack "
                    "--hostname 0.0.0.0 (container), published 127.0.0.1:3000"),
    "worker_command": ("nodemon --legacy-watch --polling-interval 1000 "
                       "--watch apps/worker --watch packages --ext ts,json "
                       "--exec node apps/worker/src/index.ts"),
    "container_user": "node (uid 1000)",
    "capabilities_effective": "0x0000000000000000 (no CAP_SYS_ADMIN)",
    "network_exposure": ("host binding is 127.0.0.1 only; container has no "
                         "published port other than 3000->127.0.0.1"),
    "application_subprocess_spawning": ("none - no child_process/exec/spawn "
                                        "reference exists in apps/** or "
                                        "packages/**"),
}

ROWS = [
    # ---------------------------------------------------------------- zlib
    dict(
        cve="CVE-2026-85091", severity=8.3, component="zlib",
        scanner_package="pkg:deb/debian/zlib@1:1.2.13.dfsg-1",
        detected_version="1:1.2.13.dfsg-1",
        installed_binary_package="zlib1g 1:1.2.13.dfsg-1",
        upstream_status="not fixed upstream (Debian bookworm: zlib <unfixed>)",
        affected_condition=("heap buffer overflow in gz_vacate() when "
                             "gzwrite() is used on a non-blocking device with a "
                             "stale external buffer; triggered via gzprintf() or "
                             "gzvprintf() after a write stall"),
        vulnerable_code_present=False,
        presence_evidence=("artifact self-reports its version in-band: "
                           "'inflate 1.2.13 Copyright 1995-2022 Mark Adler', "
                           "'deflate 1.2.13', bare '1.2.13'; highest exported "
                           "version tag is ZLIB_1.2.12. The advisory states the "
                           "non-blocking gz* support and gz_vacate() were "
                           "INTRODUCED upstream in zlib 1.3.1.2. The shipped "
                           "library predates that by a full minor series, so "
                           "the vulnerable code cannot exist in this artifact."),
        reachability=("zlib is present only as a transitive dependency of "
                      "libapt-pkg6.0, libbz2-1.0, libgcrypt20, libgpg-error0 "
                      "and liblzma5 (dpkg Depends). None of these is on the "
                      "web/worker runtime path. No gzprintf/gzvprintf "
                      "non-blocking write occurs at runtime."),
        attacker_prereq=("an attacker must cause a process in the image to call "
                         "gzprintf()/gzvprintf() on a non-blocking file "
                         "descriptor after a write stall"),
        privilege_prereq=("none beyond process reach; no CAP_SYS_ADMIN needed"),
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_present",
        receipts=[R_IDENT, R_SYMPRES, R_DPKG],
        residual_risk=("none for this artifact; would need a zlib >= 1.3.1.2 in "
                       "the base image"),
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    # ---------------------------------------------------------------- perl
    dict(
        cve="CVE-2026-48962", severity=7.3, component="perl (IO::Compress)",
        scanner_package="pkg:deb/debian/perl@5.36.0-7+deb12u3",
        detected_version="5.36.0-7+deb12u3 (perl-base)",
        installed_binary_package="perl-base 5.36.0-7+deb12u3",
        upstream_status="fixed in IO-Compress 2.220 / libio-compress-perl 2.220-1",
        affected_condition=("_parseOutputGlob() wraps the caller-supplied output "
                             "glob in double quotes and _getFiles() runs it "
                             "through eval STRING, so a double quote in the glob "
                             "executes arbitrary Perl"),
        vulnerable_code_present=False,
        presence_evidence=("module probe over the whole image returns ABSENT for "
                           "IO/Compress.pm, IO/Compress/Zip.pm and "
                           "IO/Uncompress/Unzip.pm. perl-base ships exactly 61 "
                           ".pm files (AutoLoader, Carp, Config, Cwd, DynaLoader, "
                           "Errno, Exporter, Fcntl, File::*, Getopt::Long, "
                           "Hash::Util, IO, IO::File/Handle/Pipe/Socket, "
                           "IPC::Open2/3, List::Util, POSIX, Scalar::Util, "
                           "SelectSaver, Socket, Symbol, Text::ParseWords, "
                           "Text::Tabs, Text::Wrap, Tie::Hash, XSLoader, "
                           "attributes, base, builtin, bytes, constant, feature, "
                           "fields, integer, lib, locale, overload, overloading, "
                           "parent, re, strict, utf8, vars, warnings) and the "
                           "full-image .pm census is 164 files, none of which is "
                           "IO::Compress."),
        reachability=("the vulnerable module is not installed, therefore no code "
                      "path can reach it regardless of perl invocation"),
        attacker_prereq="a perl script must call IO::Compress with an attacker-controlled output glob",
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_present",
        receipts=[R_PERL, R_DPKG],
        residual_risk="none for this artifact",
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    dict(
        cve="CVE-2026-48959", severity=7.5, component="perl (IO::Uncompress::Unzip)",
        scanner_package="pkg:deb/debian/perl@5.36.0-7+deb12u3",
        detected_version="5.36.0-7+deb12u3 (perl-base)",
        installed_binary_package="perl-base 5.36.0-7+deb12u3",
        upstream_status="fixed in IO-Compress 2.220 / libio-compress-perl 2.220-1",
        affected_condition=("fastForward() compares the digit count of the "
                             "offset against the chunk size instead of the offset, "
                             "shrinking reads to 1-19 bytes per iteration; "
                             "extracting a named entry from an attacker-supplied "
                             "zip scales CPU to the 4 GiB non-Zip64 cap"),
        vulnerable_code_present=False,
        presence_evidence=("module probe returns ABSENT for IO/Uncompress/Unzip.pm "
                           "and for Podlators.pm; not part of perl-base's 61 "
                           "modules nor of the 164-file full-image .pm census"),
        reachability="vulnerable module is not installed; unreachable in any phase",
        attacker_prereq="a perl script must extract a named entry from an attacker-supplied zip",
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_present",
        receipts=[R_PERL, R_DPKG],
        residual_risk="none for this artifact",
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    dict(
        cve="CVE-2026-82560", severity=7.5, component="perl (Pod::Text)",
        scanner_package="pkg:deb/debian/perl@5.36.0-7+deb12u3",
        detected_version="5.36.0-7+deb12u3 (perl-base)",
        installed_binary_package="perl-base 5.36.0-7+deb12u3",
        upstream_status="fixed in Podlators 6.1.1 (podlators-perl removed in Debian)",
        affected_condition=("Pod::Text wrap() subtracts the accumulated =over "
                             "indent from the output width; when that reaches "
                             "zero the substitution matches the empty string and "
                             "the loop never consumes input while padding grows, "
                             "exhausting CPU and memory"),
        vulnerable_code_present=False,
        presence_evidence=("module probe returns ABSENT for Pod/Text.pm and for "
                           "Podlators.pm; not present in perl-base nor anywhere "
                           "else in the image"),
        reachability="vulnerable module is not installed; unreachable in any phase",
        attacker_prereq="a perl script must format an attacker-supplied POD document",
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_present",
        receipts=[R_PERL, R_DPKG],
        residual_risk="none for this artifact",
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    dict(
        cve="CVE-2026-12087", severity=9.1, component="perl (Socket 2.033)",
        scanner_package="pkg:deb/debian/perl@5.36.0-7+deb12u3",
        detected_version="Socket 2.033 (perl-base)",
        installed_binary_package="perl-base 5.36.0-7+deb12u3",
        upstream_status="not fixed in Debian bookworm (libsocket-perl postponed; fixed upstream in perl 5.43.11)",
        affected_condition=("Socket.xs pack_ip_mreq_source() length-checks the "
                             "wrong argument, so a source shorter than 4 bytes "
                             "is copied into the 4-byte imr_sourceaddr field with "
                             "a fixed-size copy, reading up to 3 bytes of adjacent "
                             "heap"),
        vulnerable_code_present=True,
        presence_evidence=("HONEST FINDING: the vulnerable function IS present "
                           "and callable. Socket.pm (sha256 "
                           "39ac19481f0873c5bb198d2f6b53c802c73a04844aff0b86b8aef5add9945f20) "
                           "declares $VERSION='2.033' and lists pack_ip_mreq_source "
                           "in its export list at line 111; a runtime probe "
                           "`perl -MSocket -e 'keys %Socket::'` returns "
                           "pack_ip_mreq_source. Socket 2.033 < 2.041, so the "
                           "artifact is inside the affected range. Note that a "
                           ".dynsym miss would have been meaningless here: XS subs "
                           "are registered at boot via newXS and are not exported "
                           "ELF symbols."),
        reachability=("Socket::pack_ip_mreq_source has NO caller in the image. "
                      "The only perl code present is Debian's own maintenance "
                      "set - /usr/share/perl5/Debconf/** (~100 modules) and "
                      "/usr/share/debconf/fix_db.pl - none of which references "
                      "Socket or IP multicast packing. No PolyHunter code is "
                      "perl, and the compose runtime never executes perl at all "
                      "(web = next dev, worker = node). Debian's own assessment "
                      "matches: 'only reachable when a script passes "
                      "attacker-controlled source to pack_ip_mreq_source()'."),
        attacker_prereq=("a perl script must call Socket::pack_ip_mreq_source "
                         "with an attacker-controlled source string shorter "
                         "than 4 bytes"),
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_PERL, R_PERLREACH, R_SYMPRES],
        residual_risk=("would become reachable if any perl script in the image "
                        "began calling pack_ip_mreq_source with untrusted input; "
                        "the 9.1 CRITICAL scanner severity therefore deserves "
                        "explicit auditor confirmation"),
        expiry=EXPIRY_7D,
        confidence="medium-high",
    ),
    dict(
        cve="CVE-2026-57432", severity=8.4, component="perl core (pack/unpack)",
        scanner_package="pkg:deb/debian/perl@5.36.0-7+deb12u3",
        detected_version="perl 5.36.0 (/usr/bin/perl, 3804464 bytes)",
        installed_binary_package="perl-base 5.36.0-7+deb12u3",
        upstream_status="not fixed in Debian bookworm; fixed upstream in perl 5.43.11",
        affected_condition=("S_measure_struct sums item size x repeat count into "
                             "a signed SSize_t with no overflow check; a large "
                             "repeat count in a pack/unpack template wraps the "
                             "total negative and the @, X and x position codes "
                             "then pass their signed length guard, reading past "
                             "the buffer"),
        vulnerable_code_present=True,
        presence_evidence=("core pack/unpack is compiled into /usr/bin/perl, which "
                           "is present and runnable (perl 5.36.0, "
                           "x86_64-linux-gnu-thread-multi). Presence of the "
                           "specific static function CANNOT be asserted from the "
                           "artifact: the perl binary is stripped and builds "
                           "internal Perl_* entry points with hidden visibility, "
                           "so they are absent from .dynsym regardless. This row "
                           "is therefore decided on reachability, not on symbols."),
        reachability=("requires a pack/unpack TEMPLATE derived from untrusted "
                      "input. No perl program in the image derives a template "
                      "from external input: the only perl code is Debian's "
                      "Debconf set and fix_db.pl. Perl is never executed by the "
                      "compose runtime. Additionally the trigger needs a repeat "
                      "count near 2^63 to wrap a 64-bit SSize_t."),
        attacker_prereq="a perl script must build a pack/unpack template from attacker-controlled input",
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_PERL, R_PERLREACH, R_SYMPRES],
        residual_risk=("core perl C code is present and only unreachability "
                        "protects it; a future base image shipping a perl "
                        "workflow, or an operator running untrusted perl inside "
                        "the container, would invalidate this row"),
        expiry=EXPIRY_7D,
        confidence="medium",
    ),
    dict(
        cve="CVE-2026-13221", severity=9.1, component="perl core (regex trie optimiser)",
        scanner_package="pkg:deb/debian/perl@5.36.0-7+deb12u3",
        detected_version="perl 5.36.0 (/usr/bin/perl, 3804464 bytes)",
        installed_binary_package="perl-base 5.36.0-7+deb12u3",
        upstream_status=(
            "not fixed in Debian bookworm; fixed upstream by commit "
            "03f74bbbd3a68350d926ee93d56ee4808c28c4c7 (v5.43.10). The same advisory "
            "records 'Introduced with' commit "
            "acababb42be12ff2986b73c1bfa963b70bb5d54e (v5.37.10); both citations are "
            "transcribed from the locked SARIF advisory text for this CVE "
            "(.engineering/evidence/PH-SEC-WO-005/validation/CR-01/"
            "polyhunter-dev-cr01.sarif, blob d3999a5664ec91e2b555d468b6e85c8d04aaabe9) "
            "and were not independently re-verified against the perl5 git history."),
        affected_condition=("Perl_study_chunk stores the delta between the first "
                             "branch and the shared tail of a trie in a 16-bit "
                             "field; an alternation of more than 65535 fixed-string "
                             "branches overflows it and silently truncates the "
                             "match decision table, producing both false positive "
                             "and false negative matches"),
        vulnerable_code_present=True,
        presence_evidence=(
            "Treated as PRESENT, which is the fail-closed reading: perl is "
            "stripped and its internal symbols have hidden visibility, so a "
            ".dynsym miss proves nothing here and absence cannot be established "
            "from the artifact. The advisory's 'Introduced with' annotation places "
            "the flaw at v5.37.10, AFTER the 5.36.0 shipped in this image, which "
            "would imply absence -- but that inference is NOT treated as proof, "
            "because no version-history check against perl 5.36.0 was performed. "
            "This row is therefore decided on reachability, not on presence."),
        reachability=("requires compiling a regular expression containing an "
                      "alternation of more than 65535 fixed-string branches. No "
                      "such pattern exists in the image; the only perl code is "
                      "Debian's Debconf set, and perl is never executed by the "
                      "compose runtime."),
        attacker_prereq="a perl script must compile an attacker-controlled regex with >65535 fixed-string alternation branches",
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_PERL, R_PERLREACH],
        residual_risk=(
            "the advisory annotates 'Introduced with' v5.37.10 while this image "
            "ships 5.36.0, so the vulnerable code may well be absent -- but that "
            "was NOT verified against perl 5.36.0. Until an auditor confirms "
            "commit acababb42be12ff2986b73c1bfa963b70bb5d54e introduced the 16-bit "
            "trie delta and that 5.36.0 predates it, this row stays on the "
            "conservative reachability basis and must not be read as "
            "vulnerable_code_not_present. Core perl C code is present per the "
            "fail-closed reading, so only unreachability protects it."),
        expiry=EXPIRY_7D,
        confidence="medium",
    ),
    # ------------------------------------------------------------ util-linux
    dict(
        cve="CVE-2026-76642", severity=8.5, component="util-linux (mount)",
        scanner_package="pkg:deb/debian/util-linux@2.38.1-5+deb12u3",
        detected_version="util-linux 2.38.1-5+deb12u3 + util-linux-extra 2.38.1-5+deb12u3",
        installed_binary_package="util-linux, util-linux-extra",
        upstream_status="not fixed in Debian bookworm (<no-dsa>, minor); fixed upstream 2.42.3-1",
        affected_condition=("mount(8) runs post-mount hooks without checking the "
                             "mount helper exit status, so X-mount.idmap or "
                             "X-mount.owner hooks execute privileged operations "
                             "on a filesystem after the helper failed, cloning "
                             "suid bits or changing inode permissions"),
        vulnerable_code_present=True,
        presence_evidence=("/usr/bin/mount and /usr/bin/umount are present. "
                           "dpkg -L util-linux confirms the binaries ship. The "
                           "trigger INPUT, however, is positively absent (see "
                           "reachability)."),
        reachability=("requires (a) an /etc/fstab entry carrying an X-mount.* "
                      "option and (b) CAP_SYS_ADMIN to mount at all. Both are "
                      "disproved: /etc/fstab in this image is the stock base "
                      "file whose entire content is the single comment line "
                      "'# UNCONFIGURED FSTAB FOR BASE SYSTEM' (sha256 "
                      "a6b093c9916c6c54e5d634d3689f1a0132e14cce0b8e50ff445da8e85acfbd17) "
                      "- zero mount entries, verified by grep for "
                      "'^[^#]*(X-mount\\.|x-mount\\.)' returning nothing; and "
                      "no /sbin/mount.* helper is shipped. CapEff/CapPrm/CapInh "
                      "are all 0x0 in the container (CapBnd 0xa80425fb is only "
                      "the inherited bound and does not grant use), so mount(2) "
                      "cannot be invoked. mount/nsenter are never spawned by the "
                      "web or worker runtime."),
        attacker_prereq=("a local unprivileged user must be able to influence a "
                          "privileged mount(8) run against an attacker-authored "
                          "fstab entry; no such entry exists"),
        privilege_prereq="CAP_SYS_ADMIN (not effective: 0x0) and root",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_UTIL, R_PERLREACH, R_DPKG],
        residual_risk=("if an operator bind-mounts a host /etc/fstab with "
                        "X-mount.* options into the container and grants "
                        "CAP_SYS_ADMIN, this row must be re-opened"),
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    dict(
        cve="CVE-2026-78409", severity=7.0, component="util-linux (mount X-mount.subdir)",
        scanner_package="pkg:deb/debian/util-linux@2.38.1-5+deb12u3",
        detected_version="util-linux 2.38.1-5+deb12u3",
        installed_binary_package="util-linux, util-linux-extra",
        upstream_status="not fixed in Debian bookworm (<no-dsa>, minor); fixed upstream 2.42.3-1",
        affected_condition=("the X-mount.subdir detached-tree fast path passes "
                             "the configured subdirectory to open_tree() with "
                             "AT_SYMLINK_NOFOLLOW, which neither blocks "
                             "intermediate symlink traversal nor keeps resolution "
                             "inside the new mount, letting an unprivileged user "
                             "attach a host path at the intended mountpoint. The "
                             "fast path requires Linux 6.15 or later."),
        vulnerable_code_present=True,
        presence_evidence=("/usr/bin/mount present; trigger input absent as below"),
        reachability=("same two disproved prerequisites as CVE-2026-76642: zero "
                      "fstab entries (stock unconfigured file) so no "
                      "X-mount.subdir entry can exist, and no effective "
                      "CAP_SYS_ADMIN. Additionally the vulnerable detached-tree "
                      "fast path is documented as requiring a Linux 6.15+ host "
                      "kernel, which is a host property not controlled by this "
                      "image."),
        attacker_prereq="an fstab-authorized X-mount.subdir entry must exist and be usable by an unprivileged user",
        privilege_prereq="CAP_SYS_ADMIN (not effective)",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_UTIL, R_PERLREACH],
        residual_risk="host kernel version and any future privileged mount path would re-open this row",
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    dict(
        cve="CVE-2026-78410", severity=7.8, component="util-linux (restricted bind mount)",
        scanner_package="pkg:deb/debian/util-linux@2.38.1-5+deb12u3",
        detected_version="util-linux 2.38.1-5+deb12u3",
        installed_binary_package="util-linux, util-linux-extra",
        upstream_status="not fixed in Debian bookworm (<no-dsa>, minor); fixed upstream 2.42.3-1",
        affected_condition=("a restricted bind mount takes its source path from "
                             "fstab but does not pin that source before the "
                             "privileged mount, so replacing the authorized source "
                             "or a writable ancestor redirects SUID mount(8); if "
                             "the entry also sets X-mount.owner/group/mode, root "
                             "then chowns or chmods the redirected inode"),
        vulnerable_code_present=True,
        presence_evidence="/usr/bin/mount present; trigger input absent as below",
        reachability=("requires an fstab entry for a restricted bind mount plus "
                      "CAP_SYS_ADMIN. Both disproved: zero fstab entries and "
                      "CapEff 0x0. Not spawned by the runtime."),
        attacker_prereq="attacker must be able to replace an fstab-authorized bind-mount source or a writable ancestor",
        privilege_prereq="CAP_SYS_ADMIN (not effective) and root",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_UTIL, R_PERLREACH],
        residual_risk="any future privileged mount workflow in the dev image re-opens this row",
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    dict(
        cve="CVE-2026-78408", severity=7.9, component="util-linux (nsenter --join-cgroup)",
        scanner_package="pkg:deb/debian/util-linux@2.38.1-5+deb12u3",
        detected_version="util-linux 2.38.1-5+deb12u3",
        installed_binary_package="util-linux, util-linux-extra",
        upstream_status="not fixed in Debian bookworm (<no-dsa>, minor); fixed upstream 2.42.4 (commit 286dd3ff41526b582ef48830de239dffbaa61f90)",
        affected_condition=("nsenter --join-cgroup opens the target "
                             "cgroup.procs as root and keeps that descriptor open "
                             "across later namespace/credential changes and "
                             "execve(), so a program run in an attacker-controlled "
                             "target inherits root's ability to move host "
                             "processes between cgroups and terminate unrelated "
                             "root processes"),
        vulnerable_code_present=True,
        presence_evidence=("/usr/bin/nsenter present and shipped by util-linux"),
        reachability=("the flag requires a PRIVILEGED OPERATOR to run "
                      "nsenter --join-cgroup against a target. No npm command, "
                      "compose service or application path invokes nsenter: "
                      "grep over apps/**, packages/** and scripts/** returns no "
                      "child_process/exec/spawn reference at all, so the runtime "
                      "cannot reach it; and CapEff 0x0 means even a manual "
                      "invocation could not obtain the required privilege. The "
                      "container's cgroup namespace is not the host cgroup."),
        attacker_prereq="a privileged operator must run nsenter --join-cgroup against an attacker-controlled cgroup",
        privilege_prereq="root plus CAP_SYS_ADMIN (neither available)",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_UTIL, R_PERLREACH],
        residual_risk="would re-open if privileged/hostPID/host cgroup access were granted to this container",
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    # -------------------------------------------------------------- libstdc++
    dict(
        cve="CVE-2026-102010", severity=7.0, component="libstdc++6 (std::erase_if)",
        scanner_package="pkg:deb/debian/gcc-12@12.2.0-14+deb12u1",
        detected_version="libstdc++.so.6.0.30 (12.2.0-14+deb12u1)",
        installed_binary_package="libstdc++6 12.2.0-14+deb12u1 (gcc-12 source); gcc-12-base, libgcc-s1",
        upstream_status="not fixed (gcc-12 <unfixed>); fix commit aaa8351f4d2e636f9680a1f0a8ebc2f0a60611e6, bugzilla 127656",
        affected_condition=("erase_if() on a binary heap priority_queue "
                             "reallocates storage but fails to update its internal "
                             "entry pointer, a use-after-free reachable when an "
                             "application calls erase_if on such a queue"),
        vulnerable_code_present=False,
        presence_evidence=("std::erase_if is a HEADER-ONLY C++ template, inlined "
                           "into the consuming translation unit, so it would only "
                           "appear in libstdc++'s symbol table if libstdc++ "
                           "explicitly instantiated it. Authoritative ELF scan of "
                           "libstdc++.so.6.0.30 finds ZERO symbols containing "
                           "'erase_if' while 3012 _ZNSt* template "
                           "instantiations ARE exported - so template symbols are "
                           "visible to this method and the absence is real, not a "
                           "parser artefact. Separately, the image ships no C++ "
                           "compiler (only gcc-12-base, libgcc-s1, libstdc++6), so "
                           "no translation unit in this image can instantiate the "
                           "template, and the runtime is Node.js/JavaScript."),
        reachability=("no process in the runtime invokes std::erase_if on a "
                      "std::priority_queue; node and nodemon are the only "
                      "executables in the compose runtime and the application is "
                      "TypeScript"),
        attacker_prereq="a C++ caller must invoke std::erase_if on a binary heap priority_queue",
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_present",
        receipts=[R_SYMPRES, R_DPKG, R_IDENT],
        residual_risk=("the 3012-template positive control makes the symbol "
                        "absence strong, but a header could still exist without "
                        "an instantiated symbol; the no-compiler and "
                        "JavaScript-only runtime facts are the decisive part"),
        expiry=EXPIRY_7D,
        confidence="medium-high",
    ),
    dict(
        cve="CVE-2026-95619", severity=7.7, component="libstdc++6 (aligned operator new)",
        scanner_package="pkg:deb/debian/gcc-12@12.2.0-14+deb12u1",
        detected_version="libstdc++.so.6.0.30 (12.2.0-14+deb12u1)",
        installed_binary_package="libstdc++6 12.2.0-14+deb12u1 (gcc-12 source)",
        upstream_status="not fixed (gcc-12 <unfixed>); fix commit 59d235ffa5a69231eb42e5290d52dc8c90d28b7a, bugzilla 2537811",
        affected_condition=("integer overflow when processing large inputs to the "
                             "aligned operator new in the C++ library, leading to "
                             "an undersized allocation and potential memory "
                             "corruption or instability"),
        vulnerable_code_present=True,
        presence_evidence=("CONFIRMED PRESENT. Authoritative ELF scan of "
                           "libstdc++.so.6.0.30 shows the C++ aligned allocation "
                           "operators exported: _ZnwmSt11align_val_t, "
                           "_ZnamSt11align_val_t, _ZdlPvSt11align_val_t and "
                           "_ZdaPvSt11align_val_t. The exact mangling "
                           "align_val_t was confirmed empirically after an earlier "
                           "query using align_val produced a FALSE NEGATIVE. "
                           "node links this very library: ldd /usr/local/bin/node "
                           "resolves libstdc++.so.6 => "
                           "/lib/x86_64-linux-gnu/libstdc++.so.6. So the "
                           "vulnerable code is mapped into the running process."),
        reachability=("NOT ESTABLISHED. Reaching the overflow requires a caller "
                      "to pass an allocation size to operator new(size_t, "
                      "align_val_t) that is large enough to overflow the internal "
                      "size computation. The caller set across V8 and libstdc++ "
                      "is large and CANNOT be enumerated from inside this "
                      "container, and this analysis did not read the upstream "
                      "commit to establish the exact size threshold. The "
                      "application surface is TypeScript and cannot call a C++ "
                      "operator directly, but that is an argument, not proof."),
        attacker_prereq=("an input path that causes V8 or libstdc++ to request an "
                          "over-aligned allocation whose size is attacker-derived "
                          "and large enough to overflow - unproven either way"),
        privilege_prereq="none",
        disposition="UNDER_INVESTIGATION",
        justification=("not applicable - UNDER_INVESTIGATION carries no "
                       "justification. ADR-0007 makes a HIGH/CRITICAL default to "
                       "UNDER_INVESTIGATION, and lists 'evidence is incomplete' "
                       "as an explicit hard blocker. The vulnerable symbol is "
                       "present in a library loaded by the running Node process "
                       "and the caller set is not enumerable here, so a "
                       "NOT_AFFECTED claim would rest on assumption rather than "
                       "evidence. Fail closed."),
        receipts=[R_SYMPRES, R_IDENT],
        residual_risk=("HIGH. This is a memory-corruption class defect whose "
                       "symbol is confirmed present in a library the runtime "
                       "links. It is the single row blocking this Work Order."),
        expiry=("automatically UNDER_INVESTIGATION. Requires either an upstream "
                "Debian fix for gcc-12/libstdc++6, or an independent auditor "
                "determination - supported by the upstream commit analysis and a "
                "caller audit of V8 allocation paths - that "
                "operator new(size_t, align_val_t) is unreachable with an "
                "attacker-derived size."),
        confidence="not-assessed-blocking",
    ),
    # ------------------------------------------------------------------ pcre2
    dict(
        cve="CVE-2026-103111", severity=7.6, component="pcre2",
        scanner_package="pkg:deb/debian/pcre2@10.42-1+deb12u1",
        detected_version="libpcre2-8.so.0.11.2 (10.42-1+deb12u1)",
        installed_binary_package="libpcre2-8-0 10.42-1+deb12u1 (pcre2 source)",
        upstream_status="not fixed in Debian bookworm (fixed in trixie 10.48-3.1 / upstream 10.49, commit 2b4038298072684b0fae29b15bedfb1a75bda46d)",
        affected_condition=("out-of-bounds write with arbitrary data when an "
                             "attacker-controlled regular expression is compiled "
                             "and certain pcre2 JIT API usage follows; requires "
                             "PCRE2 before 10.49"),
        vulnerable_code_present=True,
        presence_evidence=("CONFIRMED PRESENT. libpcre2-8.so.0.11.2 exports the "
                           "8-bit JIT API: pcre2_jit_compile_8, pcre2_jit_match_8, "
                           "pcre2_jit_stack_create_8, pcre2_jit_stack_assign_8, "
                           "pcre2_jit_stack_free_8. GNU grep 3.8 in this image "
                           "IMPORTS pcre2_jit_compile_8 and its -P/--perl-regexp "
                           "option is functional (verified positively by matching "
                           "and by the negative control exiting 1 on non-match), "
                           "so the JIT path is genuinely reachable from a "
                           "user-supplied pattern. An earlier query using the "
                           "unsuffixed pcre2_jit_compile produced a FALSE NEGATIVE "
                           "and has been corrected. The library reaches grep, sed, "
                           "find, tar, install, mount, nsenter, id and ~60 other "
                           "coreutils transitively through libselinux1."),
        reachability=("the advisory requires an ATTACKER-CONTROLLED REGEX to reach "
                      "a pcre2 JIT consumer. No such path exists in the defined "
                      "runtime: web and worker never spawn a subprocess - grep "
                      "over apps/** and packages/** finds no child_process, exec, "
                      "execSync, spawn or spawnSync reference - and compose runs "
                      "only `npm run dev` and nodemon. The container also has no "
                      "inbound path other than 127.0.0.1:3000, so an external "
                      "attacker cannot supply a pattern to these utilities."),
        attacker_prereq=("an attacker must control a regex string passed to grep "
                          "-P (or another pcre2-JIT consumer) inside the "
                          "container; the web/worker runtime provides no such "
                          "channel"),
        privilege_prereq=("none to run grep -P; requires only that someone "
                          "executes it in the container"),
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_PCRE, R_GREPP, R_UTIL, R_PERLREACH],
        residual_risk=("WEAKEST NOT_AFFECTED ROW - auditor attention requested. "
                        "The vulnerable JIT code is present and functional via "
                        "grep -P. Only the absence of an application subprocess "
                        "channel keeps it unreachable. A developer manually "
                        "running grep -P over untrusted or network-fetched "
                        "content inside this container would reach it. This is a "
                        "shell-access precondition, not a remote one."),
        expiry=EXPIRY_7D,
        confidence="medium",
    ),
    # ------------------------------------------------------------ brace-expansion
    dict(
        cve="CVE-2026-14257", severity=7.5, component="npm brace-expansion",
        scanner_package="pkg:npm/brace-expansion@5.0.7",
        detected_version="5.0.7 (npm bundled) | 5.0.12 (application workspace tree)",
        installed_binary_package="npm 11.19.0 bundled dependency tree",
        upstream_status="fixed in 5.0.8 (EXPANSION_MAX_LENGTH, default 4_000_000)",
        affected_condition=("expand() bounds result COUNT via max but not result "
                             "LENGTH; chaining brace groups keeps the count under "
                             "max while each result grows, so memory scales with "
                             "max x N and a ~7.5 KB input causes an uncatchable "
                             "fatal V8 out-of-memory that terminates the process"),
        vulnerable_code_present=True,
        presence_evidence=("CONFIRMED PRESENT in npm's copy: "
                           "/usr/local/lib/node_modules/npm/node_modules/"
                           "brace-expansion is 5.0.7 and contains "
                           "N.push.apply(N, expand_(n[j], max, false)) at "
                           "dist/commonjs/index.js:197 and dist/esm/index.js:193; "
                           "no EXPANSION_MAX_LENGTH or maxLength token exists, so "
                           "the 5.0.8 fix is absent. The APPLICATION tree is a "
                           "DIFFERENT and PATCHED copy: "
                           "/workspace/node_modules/brace-expansion is 5.0.12, "
                           "above every fix version for all four brace-expansion "
                           "CVEs, and no application code imports minimatch, glob "
                           "or brace-expansion."),
        reachability=("the only importer of brace-expansion inside npm is "
                      "minimatch 10.2.5, which calls expand() through "
                      "braceExpand() - and brace expansion applies to the "
                      "PATTERN, not to the subject. Every minimatch pattern "
                      "source in npm 11.19.0 was enumerated and each originates "
                      "locally, not from the registry: "
                      "@npmcli/map-workspaces and lib/utils/get-workspaces.js read "
                      "the workspaces field of the LOCAL package.json; "
                      "ignore-walk reads the local files field during npm pack; "
                      "@npmcli/arborist query-selector-all.js matches an operator "
                      "supplied CLI query path; release-age-exclude.js matches "
                      "operator npm config (min-release-age-exclude); "
                      "@tufjs/models matches DelegatedRole paths from "
                      "signature-verified TUF metadata. Registry-supplied values "
                      "(package names, target paths) appear only as subjects. "
                      "minimatch's MAX_PATTERN_LENGTH of 65,536 does NOT block the "
                      "documented payloads, so the control that matters is pattern "
                      "provenance, and it is local. At runtime compose executes "
                      "only `npm run dev`, which performs no dependency resolution "
                      "and no glob over untrusted input."),
        attacker_prereq=("an attacker must control a GLOB PATTERN STRING that "
                          "reaches expand(); no untrusted pattern source exists in "
                          "the defined workflow"),
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_cannot_be_controlled_by_adversary",
        receipts=[R_NPMINV, R_NPMIMP, R_BRACE, R_CALLS],
        residual_risk=("npm's pattern surface is large; the enumeration is by "
                        "grep over the installed 11.19.0 tree and was not a full "
                        "control-flow audit of npm. Running `npm install <new "
                        "pkg>` inside the container would widen the pattern "
                        "surface. The application tree is already patched at "
                        "5.0.12."),
        expiry=EXPIRY_7D,
        confidence="medium",
    ),
    dict(
        cve="CVE-2026-69152", severity=7.5, component="npm brace-expansion",
        scanner_package="pkg:npm/brace-expansion@5.0.7",
        detected_version="5.0.7 (npm bundled) | 5.0.12 (application tree)",
        installed_binary_package="npm 11.19.0 bundled dependency tree",
        upstream_status="fixed in 5.0.9 (bounds the values array and expandSequence against maxLength)",
        affected_condition=("the 5.0.8 maxLength mitigation is incomplete: comma "
                             "alternatives are concatenated into `values` with no "
                             "cumulative bound, so A alternatives reach A x "
                             "maxLength and a ~25 KB input causes an uncatchable "
                             "OOM; separately expandSequence ignores maxLength, so "
                             "a ~400 KB padded input blocks the event loop for "
                             "over two minutes"),
        vulnerable_code_present=True,
        presence_evidence=("PRESENT: the same 5.0.7 implementation carrying "
                           "values.push.apply(values, expand_(...)) with no "
                           "running total, at dist/commonjs/index.js:197; no "
                           "cumulative length accounting exists in the file"),
        reachability=("identical to CVE-2026-14257 - brace expansion runs on the "
                      "pattern, every npm pattern source is local/trusted, and "
                      "the runtime performs no dependency resolution"),
        attacker_prereq="an attacker must control a glob pattern reaching expand()",
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_cannot_be_controlled_by_adversary",
        receipts=[R_NPMINV, R_NPMIMP, R_BRACE],
        residual_risk="same enumeration caveat as CVE-2026-14257",
        expiry=EXPIRY_7D,
        confidence="medium",
    ),
    dict(
        cve="CVE-2026-102276", severity=7.5, component="npm brace-expansion",
        scanner_package="pkg:npm/brace-expansion@5.0.7",
        detected_version="5.0.7 (npm bundled) | 5.0.12 (application tree)",
        installed_binary_package="npm 11.19.0 bundled dependency tree",
        upstream_status="fixed in 5.0.10 (parseCommaParts rewritten as a loop; element-wise append)",
        affected_condition=("parseCommaParts() recurses once per brace group and "
                             "spreads whole arrays with push.apply, so either "
                             "~29 KB of grouped input or ~249 KB of comma input "
                             "exhausts the native stack; both crash during PARSING "
                             "so max and maxLength never apply"),
        vulnerable_code_present=True,
        presence_evidence=("PRESENT: p.push.apply(p, postParts) and "
                           "parts.push.apply(parts, p) at "
                           "dist/commonjs/index.js:62,64 and "
                           "dist/esm/index.js:58,60 - exactly the two vectors the "
                           "advisory describes; no iterative rewrite is present"),
        reachability=("identical to CVE-2026-14257 - minimatch's 65,536-byte "
                      "MAX_PATTERN_LENGTH is above both crash thresholds, so the "
                      "only barrier is pattern provenance, which is local"),
        attacker_prereq="an attacker must control a glob pattern reaching expand()",
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_cannot_be_controlled_by_adversary",
        receipts=[R_NPMINV, R_NPMIMP, R_BRACE],
        residual_risk="same enumeration caveat as CVE-2026-14257",
        expiry=EXPIRY_7D,
        confidence="medium",
    ),
    dict(
        cve="CVE-2026-102278", severity=7.5, component="npm brace-expansion",
        scanner_package="pkg:npm/brace-expansion@5.0.7",
        detected_version="5.0.7 (npm bundled) | 5.0.12 (application tree)",
        installed_binary_package="npm 11.19.0 bundled dependency tree",
        upstream_status="fixed in 5.0.11 (maxDepth / EXPANSION_MAX_DEPTH threaded through expand_)",
        affected_condition=("expand_() recurses once per level of brace NESTING; "
                             "a single-set payload of ~6.25 KB (3,125 levels) or a "
                             "comma-member payload of ~15.6 KB (3,907 levels) "
                             "exhausts the native stack, and neither max nor "
                             "maxLength applies"),
        vulnerable_code_present=True,
        presence_evidence=("PRESENT and directly confirmed: grep for "
                           "EXPANSION_MAX_DEPTH across the package returns "
                           "ABSENT, so the depth bound that constitutes the fix "
                           "does not exist in 5.0.7"),
        reachability=("identical to CVE-2026-14257. This is the cheapest payload "
                      "of the four (~6.25 KB), far below minimatch's 65,536-byte "
                      "cap, so pattern provenance is again the only barrier"),
        attacker_prereq="an attacker must control a glob pattern reaching expand()",
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_cannot_be_controlled_by_adversary",
        receipts=[R_NPMINV, R_NPMIMP, R_BRACE],
        residual_risk="same enumeration caveat as CVE-2026-14257",
        expiry=EXPIRY_7D,
        confidence="medium",
    ),
    # ------------------------------------------------------------------- undici
    dict(
        cve="CVE-2026-19534", severity=7.5, component="npm undici",
        scanner_package="pkg:npm/undici@6.27.0",
        detected_version="6.27.0 (npm bundled only; absent from the application tree)",
        installed_binary_package="npm 11.19.0 bundled dependency tree",
        upstream_status="fixed in 6.28.1 / 7.29.1 / 8.10.2; no workaround",
        affected_condition=("the undici WebSocket client throws an uncaught "
                             "TypeError in a queueMicrotask callback during the "
                             "opening handshake when the server's 101 response "
                             "carries a Sec-WebSocket-Protocol header the client "
                             "never requested, terminating the Node process; "
                             "remote unauthenticated DoS for any application that "
                             "opens a WebSocket to an attacker-controlled or "
                             "compromised server"),
        vulnerable_code_present=True,
        presence_evidence=("PRESENT: undici 6.27.0 ships a full WebSocket client "
                           "at lib/web/websocket/ (websocket.js, connection.js, "
                           "receiver.js, sender.js, frame.js, "
                           "permessage-deflate.js). 6.27.0 is within the affected "
                           "range >= 6.7.0, < 6.28.1."),
        reachability=("the vulnerable API is never invoked. The ONLY undici "
                      "importer anywhere in npm is "
                      "node_modules/node-gyp/lib/download.js, and it imports "
                      "exactly { Agent, EnvHttpProxyAgent, RetryAgent, fetch } - "
                      "HTTP fetching only. A grep for 'WebSocket' across the whole "
                      "npm tree, excluding undici's own implementation and docs, "
                      "returns ZERO hits. npm never opens a WebSocket, so neither "
                      "the attacker-controlled-server condition nor the plaintext "
                      "ws:// MITM condition can arise."),
        attacker_prereq=("an attacker must control a WebSocket server (or the "
                          "path to one) that npm connects to; npm initiates no "
                          "WebSocket connection"),
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_NPMINV, R_NPMIMP],
        residual_risk=("would re-open if npm or node-gyp adopted undici's "
                        "WebSocket client; the application tree does not contain "
                        "undici at all"),
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    # ---------------------------------------------------------------------- tar
    dict(
        cve="CVE-2026-73566", severity=7.5, component="npm tar (node-tar)",
        scanner_package="pkg:npm/tar@7.5.19",
        detected_version="7.5.19 (npm bundled); Next.js also ships its own compiled tar under apps/web/.next/compiled/tar",
        installed_binary_package="npm 11.19.0 bundled dependency tree",
        upstream_status="fixed in 7.5.21; 7.5.19 is within the affected range <= 7.5.20",
        affected_condition=("the internal mapHas helper recurses once per path "
                             "segment with no cap, and filesFilter is installed "
                             "whenever a consumer passes a member-selection list; "
                             "a crafted GNU-L long-path header of tens of thousands "
                             "of segments overflows the stack through a filter "
                             "invoked outside the only try/catch, terminating the "
                             "process on async/streaming consumers"),
        vulnerable_code_present=True,
        presence_evidence=("PRESENT: dist/commonjs/list.js:62 defines "
                           "`const mapHas = (file, r = '') => {` and line 69 "
                           "recurses via mapHas(path.dirname(file), root) with no "
                           "segment cap; dist/esm/list.js:23,30 mirrors it. "
                           "filesFilter is exported at list.js:79."),
        reachability=("the advisory is explicit that mapHas is reachable ONLY "
                      "when a member-selection list is supplied. Every tar call "
                      "site in npm 11.19.0 was enumerated and inspected: "
                      "pacote/lib/fetcher.js:385 tar.x(#tarxOptions({cwd})) - full "
                      "extraction; node-gyp/lib/install.js:211 and :234 "
                      "tar.extract({file, strip:1, filter: isValid, onwarn, cwd}) "
                      "- uses a boolean filter, not a member list; "
                      "libnpmdiff/lib/untar.js:11 tar.list({filter: ...}) - again "
                      "filter only; npm/lib/utils/tar.js:57 and "
                      "npm/lib/commands/stage/download.js:48 tar.t({onentry}) - no "
                      "filter and no list. A grep for a `files:` option adjacent "
                      "to any tar call site returns NOTHING. node-tar itself "
                      "installs the vulnerable filter only under a guard - "
                      "list.js:140-141 `if (files?.length) filesFilter(opt, "
                      "files)` and extract.js:86 - and no caller ever makes "
                      "`files` a non-empty array, so mapHas is never reached."),
        attacker_prereq=("an attacker must supply a crafted archive AND the "
                          "victim must call tar.t/tar.x with a member-selection "
                          "list; npm never does"),
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_NPMINV, R_NPMIMP, R_CALLS],
        residual_risk=("npm is upgraded frequently and a future release could "
                        "adopt member-selection; the application also carries a "
                        "compiled tar under .next that was not separately "
                        "dispositioned here"),
        expiry=EXPIRY_7D,
        confidence="high",
    ),
    # --------------------------------------------------------------- ip-address
    dict(
        cve="CVE-2026-69192", severity=7.7, component="npm ip-address",
        scanner_package="pkg:npm/ip-address@10.2.0",
        detected_version="10.2.0 (npm bundled only; absent from the application tree)",
        installed_binary_package="npm 11.19.0 bundled dependency tree (via socks 2.8.9)",
        upstream_status="fixed in 10.3.1; 10.2.0 is within the affected range <= 10.3.0",
        affected_condition=("Address4 accepts an octet with a leading zero and "
                             "decodes it as decimal while inet_aton/getaddrinfo "
                             "and the WHATWG URL parser decode it as octal, so an "
                             "application that builds a network trust-boundary "
                             "decision on isPrivate()/isLoopback()/isInSubnet() "
                             "classifies an internal target as external and "
                             "permits the request - an SSRF filter bypass"),
        vulnerable_code_present=True,
        presence_evidence=("PRESENT: ip-address 10.2.0 is installed and consumed "
                           "by socks 2.8.9 at build/common/helpers.js:7 and "
                           "build/client/socksclient.js:21. The defect is in "
                           "Address4.parse, which is exercised."),
        reachability=("the DOCUMENTED security impact requires a trust-boundary "
                      "decision built on the classifier API. An exhaustive grep "
                      "of the socks consumer shows it calls ONLY the constructors "
                      "and formatters - new Address4(ip) at helpers.js:132 and "
                      ":150, new Address6(ip) at helpers.js:155, and "
                      "Address6.fromByteArray(...).canonicalForm() at "
                      "socksclient.js:195, :688, :779 - for validating and routing "
                      "proxy and destination hosts. ZERO calls to isPrivate, "
                      "isLoopback, isLinkLocal, isCGNAT, isInSubnet, "
                      "isHostInSubnet, Address4.isValid or correctForm exist in "
                      "the consumer. With no classifier-based allow/deny decision "
                      "anywhere in npm, the SSRF-filter-bypass outcome cannot "
                      "materialise; a mis-decode here would at most be a "
                      "correctness/connection-routing bug, which the advisory "
                      "explicitly classifies as the non-security direction."),
        attacker_prereq=("an attacker must cause a decision to be made on "
                          "Address4 classifier output; npm makes no such decision"),
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_NPMINV, R_NPMIMP, R_CALLS],
        residual_risk=("the parse defect IS reachable and socks does call "
                        "Address4, so this row turns on the absence of a "
                        "classifier-based decision rather than on absence of "
                        "execution. If npm or a future dependency ever used "
                        "ip-address as an SSRF guard, this row must be re-opened "
                        "immediately. Flagged for explicit auditor confirmation."),
        expiry=EXPIRY_7D,
        confidence="medium",
    ),
    # ------------------------------------------------------ http-cache-semantics
    dict(
        cve="CVE-2026-93748", severity=8.7, component="npm http-cache-semantics",
        scanner_package="pkg:npm/http-cache-semantics@4.2.0",
        detected_version="4.2.0 (npm bundled only; absent from the application tree)",
        installed_binary_package="npm 11.19.0 bundled dependency tree (via make-fetch-happen ^15.0.6)",
        upstream_status="not fixed at scan time (fixed_version 'not fixed'); 4.2.0 is within the affected range <= 4.2.0",
        affected_condition=("security-zeroed cache entries are not properly "
                             "validated when a client max-stale directive is "
                             "processed, letting an unauthenticated attacker "
                             "retrieve another user's Set-Cookie session "
                             "credentials from shared-cache entries that were "
                             "deliberately zeroed"),
        vulnerable_code_present=True,
        presence_evidence=("PRESENT: http-cache-semantics 4.2.0 is installed and "
                           "imported by make-fetch-happen/lib/cache/policy.js, "
                           "which is npm's HTTP cache policy implementation"),
        reachability=("the attack requires BOTH a shared multi-user cache and a "
                      "client that emits a max-stale request directive. Neither "
                      "holds. npm's cache is a single-user local disk cache at "
                      "/home/node/.npm owned by node (uid 1000), inside a "
                      "container that runs one user and publishes only "
                      "127.0.0.1:3000 - there is no second cache consumer to leak "
                      "to. And npm never emits max-stale: a grep for 'max-stale' "
                      "across the entire npm tree returns no hit outside the "
                      "library's own implementation and docs. npm also runs no "
                      "HTTP cache server - no createServer in npm/lib. With no "
                      "client max-stale and no shared cache, the credential-"
                      "recovery path does not exist."),
        attacker_prereq=("an attacker must issue a request carrying a large "
                          "max-stale value against a shared cache holding another "
                          "user's zeroed entries; npm is not such a cache and "
                          "does not send max-stale"),
        privilege_prereq="none",
        disposition="NOT_AFFECTED",
        justification="vulnerable_code_not_in_execute_path",
        receipts=[R_NPMINV, R_NPMIMP, R_CALLS],
        residual_risk=("highest-scoring npm row at 8.7; the shared-cache premise "
                        "would need revisiting if npm were ever run as a "
                        "transitive caching proxy for multiple users"),
        expiry=EXPIRY_7D,
        confidence="high",
    ),
]


def main():
    if len(ROWS) != 22:
        print(f"FATAL: expected 22 rows, got {len(ROWS)}", file=sys.stderr)
        return 2
    cves = [r["cve"] for r in ROWS]
    if len(set(cves)) != 22:
        print("FATAL: duplicate CVE rows", file=sys.stderr)
        return 2

    kev = json.loads((ROOT / "sources/cisa-kev.json").read_text(encoding="utf-8"))
    kev_ids = {v["cveID"] for v in kev["vulnerabilities"]}
    epss = {d["cve"]: d for d in json.loads(
        (ROOT / "sources/first-epss.json").read_text(encoding="utf-8"))["data"]}

    sarif = json.loads(Path(SARIF).read_text(encoding="utf-8"))
    scanner_sev, scanner_purl, fixed_version = {}, {}, {}
    for r in sarif["runs"][0]["tool"]["driver"]["rules"]:
        scanner_sev[r["id"]] = float(r["properties"]["security-severity"])
        scanner_purl[r["id"]] = r["properties"]["purls"][0]
        fixed_version[r["id"]] = r["properties"]["fixed_version"]

    out_rows = []
    for r in ROWS:
        cve = r["cve"]
        # Severity is asserted against the locked scan so a transcription slip
        # cannot silently invent a band. The PURL is taken verbatim from the
        # SARIF rather than compared to a hand-written string: the scanner emits
        # percent-encoded, qualifier-suffixed purls that are not reproducible by
        # hand, and the SARIF copy is the authority anyway.
        assert scanner_sev[cve] == r["severity"], (
            f"{cve} severity mismatch: row={r['severity']} sarif={scanner_sev[cve]}")
        out_rows.append({
            "cve": cve,
            "scanner": {
                "tool": SCANNER,
                "severity": r["severity"],
                "band": "CRITICAL" if r["severity"] >= 9.0 else "HIGH",
                "scannerPackage": scanner_purl[cve],
                "scannerPackageShort": r["scanner_package"],
                "reportedFixedVersion": fixed_version[cve],
                "receipt": R_SARIF,
                "sarifSha256": "see SHA256SUMS.txt (locked at parentHead, blob "
                               "d3999a5664ec91e2b555d468b6e85c8d04aaabe9)",
            },
            "component": r["component"],
            "detectedVersion": r["detected_version"],
            "installedBinaryPackage": r["installed_binary_package"],
            "environment": RUNTIME,
            "image": {"reference": IMAGE, "digest": DIGEST},
            "upstreamAdvisory": {
                "fixStatus": r["upstream_status"],
                "affectedCondition": r["affected_condition"],
            },
            "vulnerableCodePresent": r["vulnerable_code_present"],
            "presenceEvidence": r["presence_evidence"],
            "reachabilityEvidence": r["reachability"],
            "attackerControlledPrerequisite": r["attacker_prereq"],
            "privilegePrerequisite": r["privilege_prereq"],
            "cisaKev": {
                "inKev": cve in kev_ids,
                "catalogVersion": kev["catalogVersion"],
                "dateReleased": kev["dateReleased"],
                "note": "KEV/EPSS are prioritisation inputs only and never "
                        "convert a finding to NOT_AFFECTED (PH-SEC-VEX-POLICY).",
            },
            "firstEpss": {
                "score": epss[cve]["epss"],
                "percentile": epss[cve]["percentile"],
                "date": epss[cve]["date"],
                "note": "prioritisation only",
            },
            "vex": {
                "status": r["disposition"],
                "justification": r["justification"],
                "policy": "PH-SEC-VEX-POLICY via ADR-0007",
            },
            "residualRisk": r["residual_risk"],
            "expiryRevalidationTrigger": r["expiry"],
            "independentAuditor": "PENDING - ChatGPT/planning auditor",
            "ownerApproval": "PENDING - Project Owner",
            "dispositionTimestamp": DISPOSITION_TS,
            "confidence": r["confidence"],
            "receipts": r["receipts"],
        })

    counts = {}
    for r in out_rows:
        counts[r["vex"]["status"]] = counts.get(r["vex"]["status"], 0) + 1
    blocking = sorted(r["cve"] for r in out_rows
                      if r["vex"]["status"] in ("AFFECTED", "UNDER_INVESTIGATION"))

    doc = {
        "schemaVersion": "1.0.0",
        "workOrder": "PH-SEC-WO-007",
        "title": "Exact-image VEX disposition for the remaining 22 dev-image HIGH/CRITICAL findings",
        "branch": "security/ph-m01-dev-nongo-vex",
        "parentHead": "7d5be250255bd20cb0b20d6713f6f41c52c73b47",
        "canonicalMainSha": "64ec83d02dbf9c85ca9718eb319efb44a1d62b76",
        "parentPr": 15,
        "pr": 33,
        "image": {"reference": IMAGE, "digest": DIGEST,
                  "os": "Debian GNU/Linux 12 (bookworm)",
                  "base": "node:24-bookworm-slim",
                  "configUser": "node (uid 1000)"},
        "scanner": {"tool": SCANNER, "sarif": SARIF},
        "vexInputs": {
            "cisaKev": {"catalogVersion": kev["catalogVersion"],
                        "dateReleased": kev["dateReleased"],
                        "targetsInKev": 0},
            "firstEpss": {"date": epss[list(epss)[0]]["date"], "rows": len(epss),
                         "maxScore": max(d["epss"] for d in epss.values())},
        },
        "summary": {
            "totalFindings": len(out_rows),
            "high": sum(1 for r in out_rows if r["scanner"]["band"] == "HIGH"),
            "critical": sum(1 for r in out_rows if r["scanner"]["band"] == "CRITICAL"),
            "byStatus": counts,
            "blockingCves": blocking,
            "reviewFormat": "BLOCKED_UNRESOLVED" if blocking else "READY_FOR_INDEPENDENT_AUDIT",
        },
        "approvalState": {
            "executor": "Codex - proposing only",
            "independentAuditor": "PENDING",
            "ownerApproval": "PENDING",
            "note": "No disposition in this document is approved. The executor "
                    "cannot self-approve (PH-SEC-VEX-POLICY / ADR-0007).",
        },
        "findings": out_rows,
    }
    json.dump(doc, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())