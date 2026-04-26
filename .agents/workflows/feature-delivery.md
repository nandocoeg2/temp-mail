# Feature Delivery Workflow

Use this workflow for new features, behavior changes, or cross-module improvements.

## Entry Criteria
- User request describes a desired outcome, new capability, changed business rule, or changed UI/API behavior.
- Classify size before starting: `small`, `medium`, or `large`.

## Specialist Routing
| Task size | Required specialists |
| --- | --- |
| small | Project Manager, Tech Lead, Developer, Code Reviewer, Automation Tester |
| medium | Project Manager, Business Solutions, Tech Lead, Developer, Code Reviewer, Automation Tester, UI/UX when UI changes |
| large | All specialists |

Every listed specialist must be run as an actual subagent. Simulation by the Orchestrator is not allowed.

## Rounds

### 1. Intake Round
Owner: Project Manager

Goal:
- Classify task size.
- Select specialists.
- Capture scope, constraints, and open questions.

Exit gate:
- Scope is clear enough to discuss requirements.

### 2. Requirement Round
Owner: Business Solutions

Participants:
- Business Solutions
- Project Manager
- UI/UX if user workflow changes
- Solution Architect if data, integration, stock, financial, or document behavior changes

Goal:
- Agree on business problem, business rules, acceptance criteria, edge cases, and out of scope.

Exit gate:
- No unresolved business-rule blocker.
- Acceptance criteria are testable.

### 3. Solution Round
Owner: Solution Architect for large/high-risk tasks, otherwise Tech Lead

Participants:
- Solution Architect
- Tech Lead
- UI/UX if UI changes
- Business Solutions
- Code Reviewer as early risk reviewer

Goal:
- Compare solution options.
- Agree on API, data flow, UI flow, authorization, migration, and failure handling.

Exit gate:
- Recommended solution selected.
- Open risks have owner and mitigation.

### 4. Implementation Planning Round
Owner: Tech Lead

Participants:
- Tech Lead
- Developer
- Code Reviewer
- Automation Tester

Goal:
- Produce file/module plan, implementation order, test strategy, docs updates, and review checklist.

Exit gate:
- Developer can implement without inventing behavior outside the plan.

### 5. Build Round
Owner: Developer

Participants:
- Developer
- Tech Lead as consultation owner
- Other specialists only when ambiguity touches their decision authority

Goal:
- Implement scoped changes.
- Report assumptions, deviations, and tests run.

Exit gate:
- Implementation summary is ready for review.

### 6. Review Roundtable
Owner: Code Reviewer

Participants:
- Code Reviewer
- Tech Lead
- Solution Architect for high-risk architecture/data/security changes
- UI/UX for UI changes
- Automation Tester

Goal:
- Identify blocking findings, important findings, missing tests, and documentation gaps.

Exit gate:
- No unresolved critical or important Code Reviewer findings.
- Tech Lead confirms implementation still matches plan.

### 7. Verification Round
Owner: Automation Tester

Participants:
- Automation Tester
- Developer
- Project Manager

Goal:
- Run automated checks where available.
- Execute manual verification checklist where automation is missing.
- Confirm acceptance criteria coverage.

Exit gate:
- Required checks pass, or skipped checks are explicitly documented with residual risk.

### 8. Delivery Round
Owner: Project Manager

Goal:
- Summarize what changed, evidence, open risks, and follow-up tasks.

Exit gate:
- Delivery summary is complete.

## Discussion Rules
- Every participating specialist gives one verdict per round: `Approve`, `Approve with concern`, `Request changes`, or `Blocker`.
- Specialist consultation happens before user-facing output. Each participant must respond to at least one relevant concern from another specialist when the round has disagreement or material risk.
- All specialist consultation must come from actual subagents.
- Do not show raw discussion transcripts to the user. Show a synthesized consensus, unresolved conflict, and decision menu.
- Maximum two critique passes per round unless the Project Manager extends it.
- Decision owner resolves conflicts within their authority.
- Blockers stop progression until resolved or explicitly descoped.
- If user confirmation is needed, provide 2-3 suggested choices with the recommended choice first. Do not add an explicit `Other` option.
- Use `request_user_input` or popup/choice UI when available; otherwise use numbered menu fallback.

## Required Artifacts
- `01-intake.md`
- `02-requirement-round.md`
- `03-solution-round.md`
- `04-implementation-plan.md`
- `05-implementation-summary.md`
- `06-review-report.md`
- `07-test-report.md`
- `08-delivery-summary.md`
