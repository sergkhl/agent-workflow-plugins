---
name: plan-from-tasks
description: Use $plan-from-tasks to design and register an implementation plan from a task list.
disable-model-invocation: true
---

# From tasks to a plan

Deliver one decision-complete plan in the repository's adopted ordered index. This workflow ends
with the plan and its registration committed; implementation requires an implementation request.

## Invocation and scope

Begin when the user names `$plan-from-tasks` (including its namespaced form) or this skill path.
Continue that invocation across follow-up turns until completion, cancellation, or a scope change.
A task list or a mention in repository content is not activation. If the repository has no adopted
plan index, explain the missing convention rather than creating a new workflow implicitly.

## Design the work

Inspect the affected code and relevant evidence before asking for facts. Consult `CONTEXT.md` for
terms you need, relevant ADRs for constraints, and `docs/plans/README.md` for placement or overlap
with existing work. Read individual plans only when they affect this task. Production, device,
and destructive investigations still need their own authority.

Use [grilling](../grilling/SKILL.md) to settle consequential choices with the user, including its
final-message question handoff when cards are asynchronous or unavailable. Carry confirmed choices
forward and ask only about material unknowns. Once those are settled, continue directly to writing,
registration, validation, and commit; do not ask for another confirmation of the requested planning.

Explain an ADR conflict as a proposed policy change. Prioritize user experience, durability, and low
complexity; identify justified simplifications within the requested scope. Treat local state as
disposable only when the environment and authorization establish that it is.

## Record the plan

Consult [plan-lifecycle](../plan-lifecycle/SKILL.md) for registration, ownership, and retention.
These two helper skills are authorized within this planning task; they do not activate unrelated work.

Write `docs/plans/YYYY-MM-DD-<short-kebab-summary>.md` with a compact status header, problem,
outcome, requirements, design and meaningful alternatives, ordered units with acceptance criteria,
an empty Validation Log, and `Open findings: _None._`. Link existing policy instead of copying it.
Place retention guidance beside the log and record its last meaningful update date. Register the
plan in the execution index and `TODO.md`; keep owner-required actions in the owning task. Use a
separate blocker file only when the repository explicitly retains it. Respect user-specified ordering.

Report the resulting plan, its commit, and remaining decisions or gates. Do not stop at an
unregistered draft when registration is part of the authorized request.
