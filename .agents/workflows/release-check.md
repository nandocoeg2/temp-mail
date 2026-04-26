# Release Check Workflow

Use this workflow before packaging, deployment, demo, handoff, or production-like delivery.

## Entry Criteria
- Implementation is believed to be complete.
- Release candidate, package, branch, or delivery summary exists.

## Required Specialists
- Project Manager
- Tech Lead
- Code Reviewer
- Automation Tester
- Business Solutions for business-critical releases
- Solution Architect for migration/integration/security releases
- UI/UX for visible frontend releases

Every listed specialist must be run as an actual subagent. Simulation by the Orchestrator is not allowed.

## Rounds

### 1. Release Scope Round
Owner: Project Manager

Goal:
- Confirm what is included, excluded, and risky.
- List migrations, config changes, seed changes, docs, and manual steps.

Exit gate:
- Release scope is explicit.

### 2. Technical Readiness Round
Owner: Tech Lead

Goal:
- Confirm build, tests, docs, API collection, migrations, and environment needs.

Exit gate:
- Required technical checks are complete or exceptions are documented.

### 3. Review Sanity Round
Owner: Code Reviewer

Goal:
- Confirm no unresolved blocking findings remain.

Exit gate:
- Review gate is clean.

### 4. Verification Round
Owner: Automation Tester

Goal:
- Confirm release smoke tests and critical workflow checks.

Exit gate:
- Release is approved, approved with documented risk, or blocked.

### 5. Handoff Round
Owner: Project Manager

Goal:
- Produce release notes, verification evidence, known issues, and next steps.

## Required Artifacts
- `01-release-scope.md`
- `02-technical-readiness.md`
- `03-review-sanity.md`
- `04-release-test-report.md`
- `05-release-notes.md`

## Discussion Rules
- Specialist consultation happens before asking the user to approve release, defer release, or accept risk.
- All specialist consultation must come from actual subagents.
- Do not show raw discussion transcripts to the user. Show release readiness consensus, blockers, risk summary, and decision menu.
- If user confirmation is needed, provide 2-3 suggested choices with the recommended choice first.
- Use `request_user_input` or popup/choice UI when available; otherwise use numbered menu fallback.
- Do not add an explicit `Other` option. Avoid free-text questions unless release ownership, environment, or timing cannot be inferred.
