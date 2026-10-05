#!/usr/bin/env bash
set -u
mkdir -p /results/govulncheck/raw /results/govulncheck/tooling /results/govulncheck/go-version-m
export GOPATH=/go GOMODCACHE=/go/pkg/mod GOCACHE=/tmp/go-build HOME=/tmp/gohome GOTOOLCHAIN=auto
mkdir -p "$HOME"
go version > /results/govulncheck/go-toolchain-version.txt 2>&1
go env GOVERSION GOPROXY GOSUMDB > /results/govulncheck/go-env.txt 2>&1
go list -m -json golang.org/x/vuln@latest > /results/govulncheck/module-latest.json 2>&1
VULN_VERSION="$(go list -m -f '{{.Version}}' golang.org/x/vuln@latest 2>/results/govulncheck/module-latest.stderr)"
printf '%s\n' "$VULN_VERSION" > /results/govulncheck/module-version.txt
go mod download -json "golang.org/x/vuln@${VULN_VERSION}" > /results/govulncheck/module-download.json 2>&1
go install "golang.org/x/vuln/cmd/govulncheck@${VULN_VERSION}" > /results/govulncheck/install.stdout 2> /results/govulncheck/install.stderr
install_rc=$?
printf '%s\n' "$install_rc" > /results/govulncheck/install.exit
if [ "$install_rc" -ne 0 ]; then exit "$install_rc"; fi
/go/bin/govulncheck -version > /results/govulncheck/tool-version.txt 2>&1
/go/bin/govulncheck -help > /results/govulncheck/tool-help.txt 2>&1
cp /go/bin/govulncheck /results/govulncheck/tooling/govulncheck-linux-amd64
for name in esbuild-nested esbuild-top tsc-native; do
  go version -m "/binaries/${name}" > "/results/govulncheck/go-version-m/${name}.txt" 2>&1
  printf '%s\n' "$?" > "/results/govulncheck/go-version-m/${name}.exit"
  /go/bin/govulncheck -mode=binary -json "/binaries/${name}" > "/results/govulncheck/raw/${name}.json" 2>&1
  rc=$?
  printf '%s\n' "$rc" > "/results/govulncheck/raw/${name}.exit"
done
go version -m /go/bin/govulncheck > /results/govulncheck/tooling/go-version-m-govulncheck.txt 2>&1
printf 'analysis_finished_utc=%s\n' "$(date -u +%FT%TZ)" > /results/govulncheck/finished.txt
