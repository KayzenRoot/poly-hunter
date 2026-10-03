# PH-SEC VEX / Exploitability Disposition Policy

Status: CANONICAL upon merge of PH-SEC-PLAN-001.
Work Order: PH-SEC-PLAN-001.
Purpose: blocker-resolution planning only.

## Problem
Raw vulnerability scanners report package/component CVEs without proving that the vulnerable code is present, reachable, controllable, or exploitable in the exact PolyHunter image/runtime. Conversely, a scanner finding must never be silently ignored.

PolyHunter therefore needs a formal disposition layer between scanner output and the statement "known HIGH/CRITICAL defect".

## Non-negotiable safety rule
A HIGH/CRITICAL scanner finding defaults to UNDER_INVESTIGATION and blocks promotion.

It may stop blocking only when it is:
- FIXED; or
- NOT_AFFECTED with exact evidence and approval under this policy.

AFFECTED and UNDER_INVESTIGATION HIGH/CRITICAL always block.

No generic severity suppression, wildcard ignore, "accepted risk" shortcut, or scanner-disable flag is permitted to turn an AFFECTED/UNKNOWN HIGH/CRITICAL into a passing gate.

## VEX statuses
Use the CISA-compatible product statuses:
- NOT_AFFECTED
- AFFECTED
- FIXED
- UNDER_INVESTIGATION

Allowed NOT_AFFECTED justifications are limited to:
- component_not_present
- vulnerable_code_not_present
- vulnerable_code_cannot_be_controlled_by_adversary
- vulnerable_code_not_in_execute_path
- inline_mitigations_already_exist

A justification is an assertion, not proof. The Evidence Bundle must supply the proof.

## Required disposition record
Every HIGH/CRITICAL disposition is keyed by:
- CVE identifier;
- exact image digest;
- component/package and detected version;
- environment: local-dev / CI / staging / production-live;
- VEX status;
- VEX justification when NOT_AFFECTED;
- scanner/tool/version and receipt hash;
- vendor/upstream advisory/fix status;
- CISA KEV status;
- EPSS score/percentile when available;
- network exposure;
- privilege context;
- attacker-controlled inputs/preconditions;
- reachability/execution-path evidence;
- compensating/inline mitigation evidence;
- independent auditor;
- owner approval;
- disposition timestamp;
- expiry/revalidation trigger.

## Hard blockers
A HIGH/CRITICAL finding cannot be NOT_AFFECTED when:
- it is in CISA KEV and the exact product/runtime is exposed to the exploited path;
- exploit prerequisites are satisfied and no effective inline mitigation exists;
- an attacker can control the vulnerable operation through an exploit path that satisfies its prerequisites, and no effective inline mitigation prevents exploitation;
- evidence is incomplete or contradictory;
- image/component identity is ambiguous;
- the finding remains UNDER_INVESTIGATION.

For privileged authentication, signing, secrets, live-money, risk-engine or irreversible paths, ambiguity always fails closed.

## Environment policy

### Local development
A NOT_AFFECTED disposition may be approved when exact evidence shows the vulnerable path cannot be exercised in the local runtime. Local-only network binding, non-root execution and absent external exposure are supporting facts but are never sufficient by themselves.

### CI
The same rule applies. Ephemeral lifetime is supporting context, not an exemption.

### Production / live trading
Stricter proof is required:
- exact immutable digest;
- independent auditor;
- no applicable KEV exposure;
- explicit reachability analysis;
- explicit privilege/network review;
- revalidation on every release.
Any AFFECTED or UNDER_INVESTIGATION HIGH/CRITICAL blocks production/live.

## KEV and EPSS
CISA KEV is a hard prioritization/blocking input where the known-exploited path is applicable.
FIRST EPSS is prioritization context only. A low EPSS score never converts an AFFECTED/UNKNOWN finding to NOT_AFFECTED and never overrides KEV.

## Expiry
A HIGH/CRITICAL NOT_AFFECTED disposition expires at the earliest of:
- 7 days for local-dev/CI;
- the next production/live release for production images;
- a new image digest;
- a new scanner result changing component/version;
- a new vendor/upstream advisory;
- a KEV status change;
- a material architecture/exposure change;
- evidence becoming stale.

Expired disposition returns to UNDER_INVESTIGATION automatically.

## Evidence examples
Acceptable evidence can include:
- image SBOM/package inventory;
- executable/library inspection;
- symbol/import/call-path evidence;
- startup/runtime process inspection;
- container user/capability/network evidence;
- configuration proving feature/path disabled;
- vendor VEX/advisory;
- reproducible exploit-precondition test;
- proof that the vulnerable component/code is absent.

CVSS/EPSS alone is never reachability proof.

## Approval
For HIGH/CRITICAL:
1. executor/researcher proposes the disposition;
2. independent security auditor verifies it;
3. owner approves the disposition;
4. receipt is committed as versioned evidence.

The executor cannot self-approve.

## Relationship to current PR #15
This proposal does not disposition any PR #15 CVE. PR #15 remains BLOCKED until:
1. this policy becomes canonical through explicit owner approval; and
2. each blocking CVE is analyzed under a separate blocker-resolution Work Order against the exact final image digests.

## Standards / references
- CISA VEX Minimum Requirements: https://www.cisa.gov/sites/default/files/2023-04/minimum-requirements-for-vex-508c.pdf
- CISA VEX Status Justifications: https://www.cisa.gov/sites/default/files/publications/VEX_Status_Justification_Jun22.pdf
- CISA SBOM/VEX resources: https://www.cisa.gov/topics/cyber-threats-and-advisories/sbom/sbomresourceslibrary
- CISA KEV: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
- FIRST EPSS: https://www.first.org/epss/
- NIST SP 800-218 SSDF RV.2: https://csrc.nist.gov/pubs/sp/800/218/final
