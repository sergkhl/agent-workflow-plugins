# agent-workflow-core

A plan-driven workflow for coding agents, packaged for repository-scoped, personal Claude Code, or
marketplace installation.

The skills support research, design interviews, recorded plans, ordered execution, and
documentation maintenance. Use the entrypoint that matches the requested work.

## Skills

| Skill | Invocation | What it does |
|---|---|---|
| `research` | model | Investigates primary sources and saves concise, cited findings using repository conventions. |
| `plan-lifecycle` | model | Applies the adopted index, `TODO`/`RELEASE`, task-owned actions, closure rules, and evidence retention. |
| `plan-from-tasks` | explicit | Turns a task list into a new plan after answering what it can from the repository and grilling every remaining decision with the user, round by round. |
| `drain-plans` | explicit | Repeats batch, validation, status persistence, commit, and re-read until nothing is actionable. |
| `docs-hygiene` | explicit | Consolidates canonical documentation; retires eligible delivered work and proposes holds for inactive tasks. |
| `worklog` | explicit | Estimates hands-on effort per day from commit authorship and emits a CSV. |
| `grilling` | model | Interviews the user in rounds until every branch of the design tree is settled. |
| `grill-with-docs` | explicit | Combines `grilling` with `domain-modeling` so ADRs and glossary entries result from the interview. |
| `domain-modeling` | model | Builds and sharpens a project's ubiquitous language and ADR record. |
| `codebase-design` | model | Supplies vocabulary for deep modules, interfaces, seams, and testability. |
| `improve-codebase-architecture` | explicit | Finds deepening opportunities, reports them, then grills the selected one. |
| `wait-what` | explicit | Re-pitches an explanation that did not land. |

All twelve skills share this `skills/` source tree. Repository and global installs expose them
through relative links.

## Invocation policy

Seven skills are explicit-only:

- `docs-hygiene`
- `drain-plans`
- `grill-with-docs`
- `improve-codebase-architecture`
- `plan-from-tasks`
- `wait-what`
- `worklog`

Each carries both harness gates:

- `disable-model-invocation: true` in `SKILL.md` for Claude.
- `policy.allow_implicit_invocation: false` in `agents/openai.yaml` for Codex.

The five model-invocable skills are `codebase-design`, `domain-modeling`, `grilling`, `plan-lifecycle`,
and `research`. Plan lifecycle selection applies to creating, registering, updating, or closing
plans in an adopted workflow; reading a plan alone does not initiate maintenance.

A gated skill's default prompt names the skill explicitly. Named invocations persist within the
active task; documented helpers may be consulted within that scope. A repository reference alone
does not authorize unrelated work or additional external actions.

## Host repository assumptions

Planning and domain workflows use the repository's adopted files:

- `docs/plans/README.md` — ordered execution index and a separate hold section.
- `docs/plans/TODO.md`, `docs/plans/RELEASE.md` — active work and pending delivery/verification.
- `docs/adr/README.md` — decision index.
- `CONTEXT.md` — ubiquitous language.

Owner actions live in the owning task. A repository may explicitly retain a separate blocker file;
its absence never calls for recreating one. The [lifecycle defaults](skills/plan-lifecycle/references/conventions.md)
allow zero active workstreams and retire delivered work after more than seven days during manual
documentation hygiene. Explicit repository policies override these defaults; upgrading the plugin
does not migrate repository documents.

Project-specific commands and procedures belong in the consuming repository's real skill
directories, whether directly installed or exposed through a setup-owned catalog.

## Installation

Use the catalog's
[repository installer](https://github.com/sergkhl/agent-workflow-plugins/blob/main/scripts/install-repository.mjs) for a pinned team-repository
installation or, with `--global`, for pinned personal Claude Code skills. The catalog
[README](https://github.com/sergkhl/agent-workflow-plugins) also covers marketplace installs.
Do not enable two copies in the same working context.

Repository installation is an explicit operation managed by the installer.

## License and provenance

Original work is MIT licensed. `grilling`, `grill-with-docs`, `domain-modeling`, `codebase-design`,
`improve-codebase-architecture`, `research`, and `wait-what` were derived from
[`mattpocock/skills`](https://github.com/mattpocock/skills) and have since diverged. The complete
upstream MIT notice is in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Maintaining instructions

Keep descriptions short and specific to the capability. Put the outcome, essential constraints,
and useful routing in the entrypoint; load detailed procedures only for the relevant operation.
Preserve named opt-in gates, user intent, meaningful completion criteria, and operational
boundaries. Prefer scoped evidence over mandatory reading itineraries or repeated passing tests.
These conventions follow [OpenAI's skills and prompts guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
and remain useful across models. Validate metadata, references, and realistic task decisions.
