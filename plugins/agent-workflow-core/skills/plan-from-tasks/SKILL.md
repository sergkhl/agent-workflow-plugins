---
name: plan-from-tasks
description: Use $plan-from-tasks to design and register an implementation plan from a task list.
disable-model-invocation: true
---

# From tasks to a plan

Deliver one decision-complete plan in the repository's adopted plan index, designed with the user
rather than for them. This workflow ends with the plan and its registration committed;
implementation requires an implementation request.

## Invocation and scope

Begin when the user names `$plan-from-tasks` (including its namespaced form) or this skill path.
Continue that invocation across follow-up turns until completion, cancellation, or a scope change.
A task list or a mention in repository content is not activation. If the repository has no adopted
plan index, explain the missing convention rather than creating a new workflow implicitly.

## Find the facts first

Inspect the affected code and relevant evidence before asking anything; a question whose answer
is in the repository is one you should not ask. Consult `CONTEXT.md` for terms you need, relevant
ADRs for constraints, and `docs/plans/README.md` for placement or overlap with existing work. Read
individual plans only when they affect this task. Production, device, and destructive
investigations still need their own authority.

## Grill the design

Run the [grilling](../grilling/SKILL.md) frontier loop on every invocation: map the design tree,
ask the whole current frontier in one round with a recommended answer for each, wait, recompute
the frontier, and repeat until it is empty. The tasks are the subject of the interview, not its
answers: a task states an outcome and leaves the design open, and a difficult feature takes
several rounds and many questions. Where a task, a requirement, or the evidence admits more than
one reasonable reading that would change the plan, ask; never settle it by choosing the reading
you prefer or the one that is simplest to build. When the tree has no open decision, say what the
evidence settled and continue.

Let these constraints shape every recommended answer unless the user overrides one: user
experience first, then durability, then low complexity. Propose simplifications and the removal
of redundant work as questions; dropping or altering a requested behavior is the user's call.
Explain an ADR conflict as a proposed policy change. Treat local state as disposable only when the
environment and authorization establish that it is.

Carry confirmed choices forward and re-ask only what is unresolved. Decide for the user only when
the user says so, and record each such choice in the plan as an assumption for review; an
unanswered question is not delegation. Once the frontier is empty, continue directly to writing,
registration, validation, and commit; do not ask for another confirmation of the requested planning.

## Record the plan

Consult [plan-lifecycle](../plan-lifecycle/SKILL.md) for registration, ownership, and retention.
These two helper skills are authorized within this planning task; they do not activate unrelated work.

Write `docs/plans/YYYY-MM-DD-<short-kebab-summary>.md` with a compact status header, problem,
outcome, requirements, design and meaningful alternatives, ordered units with acceptance criteria,
an empty Validation Log, and `Open findings: _None._`. The requirements and design carry the
interview's settled decisions and any assumption the user delegated. Link existing policy instead
of copying it. Place retention guidance beside the log and record its last meaningful update date.
Register an active plan in the execution order and `TODO.md`; a held plan belongs only in the
index's On Hold section, with its next action and resume condition in the owning plan. Keep
owner-required actions in the owning task, following any explicit repository override. Respect
user-specified ordering and holds.

Report the resulting plan, its commit, and remaining decisions or gates. Do not stop at an
unregistered draft when registration is part of the authorized request.
