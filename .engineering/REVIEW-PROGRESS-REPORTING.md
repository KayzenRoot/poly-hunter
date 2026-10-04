# Review Progress Reporting

Status: CANONICAL upon merge of PH-GOV-WO-001.

## Purpose
Every review response must end with a compact, evidence-based progress snapshot so the owner can see what is complete, what remains, how far the MVP has advanced, and the estimated execution effort still ahead.

This document controls reporting only. It does not promote repository state, satisfy a Definition of Done item, authorize implementation, or override Checkpoint / Scope / Requirements / Architecture / Security / Evidence.

## Mandatory trigger
After every review/audit response that produces one of these verdicts:
- APPROVED;
- APPROVED FOR PROMOTION / OWNER APPROVAL;
- CORRECTION REQUIRED;
- BLOCKED;

the reviewer MUST append a **Project Progress Snapshot**.

This applies to product, planning, governance, security, migration, deployment and blocker-resolution reviews.

## Mandatory fields
The snapshot must contain:

1. **Review state**
   - PR / Work Order;
   - exact audited head SHA when available;
   - verdict.

2. **Completion**
   - canonical completed-through module from Checkpoint;
   - estimated MVP completion percentage;
   - estimated MVP remaining percentage;
   - active module / Work Order completion estimate when meaningful.

3. **Done**
   - concise list of merged/accepted modules or major increments already proven.

4. **Remaining**
   - current blocker/correction if any;
   - next necessary increments;
   - remaining NECESSARY modules.

5. **Time estimate**
   - estimate to the next meaningful milestone;
   - estimate to MVP completion when enough information exists;
   - use a range, not false precision;
   - explicitly state whether the estimate is active execution time, wall-clock time, or excludes external waiting.

6. **Prompt estimate**
   - estimated Codex/executor prompts to the next milestone;
   - estimated Codex/executor prompts to MVP completion;
   - estimated review/correction cycles separately when useful.

7. **Confidence / assumptions**
   - HIGH / MEDIUM / LOW confidence;
   - name material assumptions or external blockers.

## Canonical facts vs estimates
Never mix repository truth with forecasting.

### Canonical facts
Use exact repository evidence in this order:
1. current Checkpoint;
2. merged commits / exact Git state;
3. approved Decisions / ADRs;
4. Scope / Requirements / Architecture / Security / DoD;
5. accepted Evidence Bundles and PR audit verdicts.

A branch-only implementation is not "complete" at project level until the governing flow promotes/merges it.

### Estimates
Percent, time and remaining-prompt forecasts are reporting estimates unless explicitly stored as canonical weighted checkpoint data.

Every estimate must be labeled **ESTIMATE** or use wording such as `~`, `about`, or a range.

## Percentage method

### A. Canonical weighted completion
If `.engineering/CHECKPOINT.json` has a non-zero, valid production denominator and earned weight, report its canonical percentage exactly.

If the canonical denominator is zero/uninitialized, report:
- `Canonical completion: N/A (denominator not initialized)`.

Do not fabricate a canonical percentage.

### B. Estimated MVP completion
When canonical weighted completion is unavailable, produce an **Estimated MVP completion** from the frozen Backlog.

Default denominator:
- NECESSARY modules only.
- IMPORTANT and FUTURE modules are excluded unless a later approved decision promotes them into MVP/NECESSARY scope.

Default module weight:
- each NECESSARY module = 1 equal unit unless an approved weighting model exists.

Module credit:
- merged/Checkpoint-complete module = 100% of its unit;
- unstarted module = 0%;
- active module = fraction derived from its frozen implementation Work Orders;
- merged/accepted Work Order = full share of its module fraction;
- current unmerged Work Order may receive evidence-based partial credit from satisfied acceptance criteria, but MUST be capped below 100% until approved/merged;
- blocked work keeps any already-proven partial credit but cannot be reported as complete.

If the module has no frozen Work Order decomposition, use a conservative range and LOW confidence instead of inventing exact fractional credit.

Estimated MVP remaining = 100% - Estimated MVP completion.

## Active Work Order percentage
When useful, estimate the current Work Order from objectively testable acceptance criteria:
- passed/proven acceptance criteria / total acceptance criteria;
- mandatory security/approval gates count as unsatisfied until cleared;
- STOP CONDITION not met => never 100%.

Label this as `Active Work Order estimate`.

## Time estimation
Time is always a forecast.

Preferred basis:
1. observed durations of comparable completed Work Orders in repository evidence;
2. known remaining Work Orders and risk levels;
3. known CI / review / migration / security gates.

Report ranges.

Default interpretation:
- `Active execution time` excludes waiting for upstream vendors, human availability, external approvals, provider outages and CI queue time unless explicitly included.
- If an external dependency can dominate the schedule, also state `Wall-clock: unknown / externally gated`.

Do not promise a date unless the evidence supports one.

## Remaining prompt estimation
A "prompt" in this report means one actionable executor handoff/correction prompt, normally sent to Codex.

Estimate from:
- one initial execution prompt per remaining admitted Work Order;
- expected correction prompts based on risk/evidence;
- known blocker-resolution prompts;
- do not count ordinary conversational questions as executor prompts.

Default planning ranges when no better repository history exists:
- LOW: 1 execution prompt per increment;
- STANDARD: 1-2;
- ELEVATED: 2-3;
- HIGH_ASSURANCE: 2-5.

Report reviews separately when useful:
- `Review cycles remaining: X-Y`.

Future modules whose Work Orders are not yet frozen must use a range, not an exact prompt count.

## Required compact template

```text
Project Progress Snapshot
Review: <WO/PR> — <VERDICT> — head <SHA>

Canonical completed through: <module/state>
Canonical completion: <N/A or exact canonical %>
Estimated MVP completion: ~<x>% done / ~<y>% remaining
Active module/WO: ~<x>% (if meaningful)

Done:
- ...

Remaining:
- ...

Estimated time:
- Next milestone: <range>
- MVP: <range or unknown>
- External waits: <none / describe>

Estimated prompts:
- To next milestone: <range> Codex prompts
- To MVP: <range> Codex prompts
- Review/correction cycles: <range>

Confidence: <HIGH/MEDIUM/LOW>
Basis: <checkpoint / PR / evidence>
```

## Honesty rules
- A completed executor message is not proof.
- A green CI run alone is not module completion.
- A branch-only Work Order is not merged project truth.
- A blocked Work Order can be highly implemented while still being incomplete.
- Estimates must change when evidence changes.
- If the estimate cannot be responsibly made, report `unknown` rather than inventing a number.
