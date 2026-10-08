set -eu
printf '%s\n' '--- image package/runtime ---'
dpkg-query -W -f='${Package}=${Version}\n' util-linux
uname -r
id node
printf '%s\n' '--- fstab ---'
stat -c '%A %a %U:%G %n' /etc/fstab
cat /etc/fstab
printf '%s\n' '--- mount option strings ---'
strings /usr/bin/mount | grep -E 'X-mount\.(subdir|owner|group|mode|idmap)' || true
printf '%s\n' '--- nsenter cgroup option ---'
nsenter --help 2>&1 | grep -E 'join-cgroup|cgroup' || true
printf '%s\n' '--- privileged executable metadata ---'
stat -c '%A %a %U:%G %n' /usr/bin/mount /usr/bin/nsenter
printf '%s\n' '--- process credential/capability indicators ---'
grep -E '^(Uid|Gid|CapEff|CapPrm|NoNewPrivs):' /proc/1/status
printf '%s\n' '--- compose/package command sites ---'
