# Code Review Workflow

Use this workflow for reviewing a diff, pull request, branch, or completed implementation.

## Entry Criteria
- There is a changed file list, diff, PR, branch, or implementation summary to review.

## Specialist Routing
| Change risk | Required specialists |
| --- | --- |
| low | Code Reviewer, Tech Lead |
| medium | Code Reviewer, Tech Lead, Automation Tester |
| high | Code Reviewer, Tech Lead, Solution Architect, Automation Tester, UI/UX if UI changes, Business Solutions if business rules change |

Every listed specialist must be run as an actual subagent. Simulation by the Orchestrator is not allowed.

## Rounds

### 1. Scope Round
Owner: Project Manager or Tech Lead

Goal:
- Understand intent, changed files, risk areas, and required context.

Exit gate:
- Review scope and expected verdict are clear.

### 2. Specialist Review Round
Owner: Code Reviewer

Goal:
- Review functionality, security, data integrity, maintainability, tests, and docs.
- Request additional specialist review for architecture, UI, or business rule risk.

Exit gate:
- Findings are prioritized.

### 3. Resolution Round
Owner: Tech Lead

Goal:
- Decide which findings block merge/delivery.
- Assign fixes or document accepted risk.

Exit gate:
- Blocking findings are resolved, deferred with owner, or explicitly rejected with rationale.

### 4. Verification Round
Owner: Automation Tester

Goal:
- Confirm required checks were run after fixes.

Exit gate:
- Review verdict and test evidence are complete.

## Required Artifacts
- `01-review-scope.md`
- `02-review-report.md`
- `03-resolution-log.md`
- `04-test-report.md`

## Discussion Rules
- Code Reviewer leads findings, then Tech Lead and relevant specialists challenge severity, scope, and fix direction.
- Specialist consultation happens before user-facing output.
- All specialist consultation must come from actual subagents.
- Do not show raw discussion transcripts to the user. Show prioritized findings, consensus, disputed items, and decision menu.
- If user confirmation is needed for accepted risk, deferral, or fix strategy, provide 2-3 suggested choices with the recommended choice first.
- Use `request_user_input` or popup/choice UI when available; otherwise use numbered menu fallback.
- Do not add an explicit `Other` option. Avoid free-text questions unless the review cannot continue without information not inferable from the diff or project context.
