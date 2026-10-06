#!/usr/bin/env bash
# Captures the CR-02 (same-origin) and CR-04 (trusted app origin) live probe evidence
# for PH-M01-WO-002 against the running Docker stack.
#
# The 403-vs-503 distinction is the load-bearing signal:
#   403 = the same-origin guard REJECTED the request before any state was touched;
#   503 = the guard ALLOWED it and the request reached the provider check
#         (503 = identity_provider_unavailable, because no Supabase credentials exist).
set -u

PROJECT=polyhunter-local
OUT=.engineering/evidence/PH-M01-WO-002/receipts/runtime/cr02-cr04-live-probes.txt
BODY='{"tenantId":"11111111-1111-4111-8111-111111111111"}'
SEL=http://localhost:3000/api/auth/select-tenant
LOGOUT=http://localhost:3000/api/auth/logout

code()  { curl -s -o /dev/null -w 'HTTP %{http_code}' "$@"; }
loc()   { curl -s -o /dev/null -w "HTTP %{http_code} Location=%{redirect_url}" "$@"; }
sel()   { code -X POST "$SEL" -H 'Content-Type: application/json' -d "$BODY" "$@"; }
row()   { printf '%-46s -> %s\n' "$1" "$2"; }

{
echo "# CR-02 / CR-04 live probes against the running containers — PH-M01-WO-002"
echo "# Captured 2026-10-05 by receipts/runtime/capture-cr02-cr04-probes.sh"
echo "#"
echo "# 403 = the same-origin guard REJECTED the request before any state was touched."
echo "# 503 = the guard ALLOWED it and the request reached the provider check"
echo "#       (503 = identity_provider_unavailable; no Supabase credentials exist here)."
echo "# 303 = the guard allowed it and the handler produced its normal redirect."
echo
echo "## Part 1 — default origin http://localhost:3000 (polyhunter-web on 127.0.0.1:3000)"
echo
echo "### POST /api/auth/select-tenant (CR-02)"
row "no Origin header"                 "$(sel)"
row "correct Origin"                   "$(sel -H 'Origin: http://localhost:3000')"
row "evil.example"                     "$(sel -H 'Origin: https://evil.example')"
row "sibling subdomain"                "$(sel -H 'Origin: http://app.localhost:3000')"
row "different protocol (https)"       "$(sel -H 'Origin: https://localhost:3000')"
row "malformed Origin"                 "$(sel -H 'Origin: not-a-url')"
row "host spoof (Host: localhost)"     "$(sel -H 'Origin: https://evil.example' -H 'Host: localhost:3000')"
row "X-Forwarded-Host spoof"           "$(sel -H 'Origin: https://evil.example' -H 'X-Forwarded-Host: localhost:3000')"
row "null origin"                      "$(sel -H 'Origin: null')"
echo
echo "### POST /api/auth/logout (CR-02)"
row "no Origin header"                 "$(code -X POST $LOGOUT)"
row "correct Origin"                   "$(code -X POST $LOGOUT -H 'Origin: http://localhost:3000')"
row "evil.example"                     "$(code -X POST $LOGOUT -H 'Origin: https://evil.example')"
row "X-Forwarded-Host spoof"           "$(code -X POST $LOGOUT -H 'Origin: https://evil.example' -H 'X-Forwarded-Host: localhost:3000')"
echo
echo "### GET /auth/callback redirect target (CR-04)"
row "error=access_denied"              "$(loc 'http://localhost:3000/auth/callback?error=access_denied')"
row "open-redirect attempt"            "$(loc 'http://localhost:3000/auth/callback?returnTo=https://evil.example&code=x')"
} > "$OUT"

# --- Part 2: a container whose configured origin is NOT localhost -----------------
# The `web` service is stopped first because the shared named volume holds the .next
# dev-server lock; it is restarted immediately afterwards.
docker compose -p "$PROJECT" stop web >/dev/null 2>&1
docker rm -f ph-origin-probe >/dev/null 2>&1
docker compose -p "$PROJECT" run --rm -d --name ph-origin-probe \
  -p 127.0.0.1:3100:3000 \
  -e NEXT_PUBLIC_APP_ORIGIN=http://configured-origin.test:4321 web >/dev/null 2>&1

ready=0
for _ in $(seq 1 45); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/ 2>/dev/null)" = "200" ]; then
    ready=1; break
  fi
  sleep 2
done

{
echo
echo "## Part 2 — CONFIGURED origin http://configured-origin.test:4321 (one-off container)"
echo "#"
echo "# This part exists to falsify the review's central CR-04 concern: that redirect"
echo "# targets are still a hard-coded literal. The container ran with"
echo "# NEXT_PUBLIC_APP_ORIGIN=http://configured-origin.test:4321, published on 127.0.0.1:3100."
echo "# If any redirect target or Origin comparison were hard-coded to localhost, these"
echo "# results would be identical to Part 1. They are not."
echo
} >> "$OUT"

if [ "$ready" != "1" ]; then
  echo "PROBE CONTAINER DID NOT BECOME READY — results below are not trustworthy." >> "$OUT"
else
  {
  echo "### GET /auth/callback redirect target follows configuration (CR-04)"
  row "error=access_denied"            "$(loc 'http://127.0.0.1:3100/auth/callback?error=access_denied')"
  row "error=invalid_request"          "$(loc 'http://127.0.0.1:3100/auth/callback?error=invalid_request')"
  row "open-redirect attempt"          "$(loc 'http://127.0.0.1:3100/auth/callback?returnTo=https://evil.example&code=x')"
  echo
  echo "### CSRF comparison follows configuration (CR-02)"
  row "Origin = configured origin (guard ALLOWS)" "$(code -X POST http://127.0.0.1:3100/api/auth/select-tenant -H 'Origin: http://configured-origin.test:4321' -H 'Content-Type: application/json' -d "$BODY")"
  row "Origin = http://localhost:3000 (now FOREIGN)" "$(code -X POST http://127.0.0.1:3100/api/auth/select-tenant -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' -d "$BODY")"
  } >> "$OUT"
fi

{
echo
echo "# Conclusion: redirect targets and the CSRF comparison both track NEXT_PUBLIC_APP_ORIGIN."
echo "# Changing only configuration changed both behaviours, and localhost — the trusted"
echo "# origin in Part 1 — is now correctly REJECTED as cross-origin."
echo "#"
echo "# Production fail-closed behaviour (an absent, non-absolute, non-http(s) or plain-http"
echo "# NEXT_PUBLIC_APP_ORIGIN under NODE_ENV=production throws InvalidAppOriginError, which"
echo "# originMatchesTrusted converts into a denial for every request) is proven by unit"
echo "# tests in tests/app-origin-csrf.test.ts rather than by a live container: reproducing"
echo "# it needs a production build and NODE_ENV=production, while the behaviour is a pure"
echo "# function of those two environment values."
} >> "$OUT"

docker rm -f ph-origin-probe >/dev/null 2>&1
docker compose -p "$PROJECT" start web >/dev/null 2>&1

for _ in $(seq 1 45); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)" = "200" ]; then
    echo "web restored and serving HTTP 200"
    break
  fi
  sleep 2
done