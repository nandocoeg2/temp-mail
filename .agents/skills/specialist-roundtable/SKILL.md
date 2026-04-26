---
name: specialist-roundtable
description: Use when coordinating project work through specialist agents, multi-role discussion, feature delivery, bugfix triage, code review gates, release checks, or structured SDLC workflow automation.
---

# Specialist Roundtable

Coordinate project work through moderated specialist discussion before implementation, review, verification, or release.

## Core Rule
Do not treat specialists as a linear checklist. Always use actual subagents for selected specialists, run explicit discussion rounds, collect each specialist verdict, resolve conflicts through the decision owner, and record decisions before advancing gates.

## Subagent Requirement
- Always dispatch each selected specialist as an actual subagent.
- Do not simulate specialist roles inside the Orchestrator.
- Do not let the Orchestrator answer on behalf of a specialist.
- If the platform has a subagent tool, use it for every selected specialist before producing user-facing decisions.
- If subagents are unavailable, stop the workflow and report that specialist roundtable execution requires subagent support.
- Reuse the same specialist subagent within a workflow when follow-up consultation depends on its prior context.
- Keep specialist write scopes disjoint when implementation work is delegated.

## Human Interaction Policy
- Use structured choices for confirmations; free-text is not the default interaction path.
- Start with Specialist consultation: when confirmation is needed, first let the relevant specialists discuss and narrow the decision to 2-3 options.
- Present the user with a structured decision menu after specialist consultation, not before.
- Use `request_user_input` or the platform's popup/choice UI tool when available.
- If popup/choice UI is unavailable, use numbered menu fallback in chat.
- Always put the recommended option first and label it `(Recommended)`.
- Each option must include one short trade-off sentence.
- Do not add an explicit `Other` option. Free-text is not a default path; only accept it when the available choices cannot represent the decision.
- Do not expose raw specialist transcripts to the user. Show only the decision menu, concise rationale, blockers, and next action.

## Project Files
Load only the files needed for the current task:

- Role cards: `.agents/subagents/*.md`
- Workflows: `.agents/workflows/*.md`
- Templates: `.agents/templates/*.md`

## Workflow Selection
| User intent | Workflow |
| --- | --- |
| New feature or behavior change | `.agents/workflows/feature-delivery.md` |
| Bug, regression, wrong result, failing test | `.agents/workflows/bugfix.md` |
| Review branch, diff, PR, or completed patch | `.agents/workflows/code-review.md` |
| Pre-release, package, deployment, demo, handoff | `.agents/workflows/release-check.md` |

## Operating Steps
1. Read the selected workflow and the required role cards.
2. Classify task size/risk using the workflow rules.
3. Create or update a run folder when artifacts are requested: `docs/agent-runs/YYYY-MM-DD-short-slug/`.
4. For each round, give all selected specialists the same context.
5. Run Specialist consultation through actual subagents: each specialist responds to the previous specialist's concern before giving a verdict.
6. Ask each specialist for: position, concern, suggestion, and verdict.
7. Summarize conflicts and let the decision owner resolve them.
8. If user input is required, produce a decision menu with 2-3 suggested options.
9. Stop at any blocker until it is resolved, descoped, or accepted by the correct decision owner.
10. Advance only when the round exit gate passes.
11. End with delivery summary, review verdict, or next action depending on workflow.

## Specialist Verdicts
- `Approve`: no blocking concern.
- `Approve with concern`: can proceed, but document risk.
- `Request changes`: must revise before the owner accepts the round.
- `Blocker`: cannot advance until resolved or explicitly descoped.

## Decision Owners
| Decision | Owner |
| --- | --- |
| Business rules and acceptance criteria | Business Solutions |
| Scope, sequencing, and workflow progression | Project Manager |
| Architecture, integrations, and data model | Solution Architect |
| UI workflow and interaction behavior | UI/UX |
| Implementation plan and technical done criteria | Tech Lead |
| Implementation details inside approved plan | Developer |
| Code quality gate | Code Reviewer |
| Verification gate | Automation Tester |

## Discussion Constraints
- Maximum two critique passes per round unless the Project Manager extends it.
- Do not let Developer start implementation while requirement or solution blockers remain.
- Do not deliver while Code Reviewer has unresolved critical/important findings.
- Do not claim verification passed without command output or explicit manual evidence.
- Do not simulate the roundtable internally. Actual subagents are required; if they are unavailable, stop and ask the user to run the workflow in an environment with subagent support.

## Decision Menu Format
Use this whenever the user must choose:

```md
## Decision Needed
Context: <one sentence>

1. <Option> (Recommended)
   Impact: <one short trade-off>

2. <Option>
   Impact: <one short trade-off>

3. <Option>
   Impact: <one short trade-off>

Specialist consensus: <one sentence>
```

If `request_user_input` or another popup/choice UI tool is available, map the same options into that tool and avoid asking for free text. If no popup is available, use numbered menu fallback.

## Output Format
For chat-only use, produce:

```md
## Workflow
## Task Size / Risk
## Selected Specialists
## Specialist Consensus
## Decision Menu
## Blockers
## Next Action
```

For artifact use, copy the relevant templates from `.agents/templates/` into the run folder and fill them as each round completes.

## Artifact Detail
Use Detailed notes for internal artifacts: capture specialist position, concern, suggestion, verdict, and consultation response. Do not store full raw transcripts unless the user explicitly asks for an audit log.
