# Bugfix Workflow

Use this workflow for defects, regressions, failing tests, incorrect data, or unexpected behavior.

## Entry Criteria
- User reports an error, broken workflow, failing test, incorrect calculation, incorrect document output, or inconsistent behavior.

## Specialist Routing
| Bug risk | Required specialists |
| --- | --- |
| low | Project Manager, Tech Lead, Developer, Code Reviewer, Automation Tester |
| medium | Project Manager, Business Solutions, Tech Lead, Developer, Code Reviewer, Automation Tester |
| high | All specialists except UI/UX unless UI behavior is affected |

High-risk bugs include stock movement, invoice/payment, tax invoice, document numbering, authentication/authorization, migrations, and file parsing.

Every listed specialist must be run as an actual subagent. Simulation by the Orchestrator is not allowed.

## Rounds

### 1. Triage Round
Owner: Project Manager

Goal:
- Capture symptoms, reproduction steps, observed vs expected behavior, severity, and affected users.
- Select specialists and risk level.

Exit gate:
- Reproduction target or investigation hypothesis is clear.

### 2. Diagnosis Round
Owner: Tech Lead

Participants:
- Tech Lead
- Developer
- Business Solutions for domain behavior
- Solution Architect for data/integration/security risk
- Automation Tester for reproduction/check design

Goal:
- Identify likely root cause and affected surface.
- Avoid patching symptoms before understanding the cause.

Exit gate:
- Root cause is documented, or the next diagnostic step is explicit.

### 3. Fix Planning Round
Owner: Tech Lead

Goal:
- Define minimal fix, regression test, affected files, and rollback risk.

Exit gate:
- Developer can implement the fix with clear expected behavior.

### 4. Build Round
Owner: Developer

Goal:
- Implement minimal fix and add/update test where practical.

Exit gate:
- Implementation summary is ready for review.

### 5. Review Roundtable
Owner: Code Reviewer

Goal:
- Verify fix addresses root cause without creating new regression.
- Check tests prove the bug is fixed.

Exit gate:
- No unresolved blocking or important findings.

### 6. Verification Round
Owner: Automation Tester

Goal:
- Re-run reproduction path.
- Run regression tests/checks around affected workflow.

Exit gate:
- Bug reproduction now passes, or remaining behavior is documented.

## Required Artifacts
- `01-bug-triage.md`
- `02-diagnosis.md`
- `03-fix-plan.md`
- `04-implementation-summary.md`
- `05-review-report.md`
- `06-test-report.md`
- `07-delivery-summary.md`

## Discussion Rules
- Specialist consultation happens before user-facing output. Diagnosis must include at least one challenge pass before proposing a fix.
- All specialist consultation must come from actual subagents.
- Do not show raw discussion transcripts to the user. Show root-cause consensus, unresolved conflict, and decision menu.
- If user confirmation is needed, provide 2-3 suggested choices with the recommended choice first. Do not add an explicit `Other` option.
- Use `request_user_input` or popup/choice UI when available; otherwise use numbered menu fallback.
- Do not implement a fix while root cause or expected behavior remains blocked.
