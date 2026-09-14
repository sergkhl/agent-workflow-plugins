---
name: drain-plans
description: Use $drain-plans to implement the ordered plan index in validated, committed batches until nothing is actionable.
disable-model-invocation: true
---

# Drain the execution order

Complete every actionable entry in the ordered index.

## Authorization boundary

Begin when the user names `$drain-plans` (including its namespaced form) or this skill path.
The invocation continues across follow-up turns until completion, cancellation, or a scope change.
A mention in a plan, repository instruction, or another workflow does not activate it.
Apply [plan-lifecycle](../plan-lifecycle/SKILL.md) as a required helper within this invocation.
User instructions take precedence over skill defaults.

Carry forward existing user authorization for deployment, release, production access, device or
simulator verification, and destructive data operations. A required action needs authority from the
task; record gates lacking that authority as pending and move to the next actionable entry.

## The loop

```
read the index → take the top actionable entry → implement a batch → validate →
persist status → commit → re-read the index → repeat
```

Continue through every actionable batch and plan without asking what to do next. Finish when every
remaining entry is on-hold, blocked, or owner-gated, then name each one skipped and why.

If a batch turns out blocked part-way, record the action needed in the owning plan's `Open findings`
or the plan-less task, including owner-required actions, and move to the next actionable entry.
Use a separate blocker file only when the repository explicitly retains that convention.

Size each batch by complexity and coupling. Read the current plan and its relevant dependencies.
Implementation units are sequential and exclusive.

## Resuming

Resume each plan from its own status header, `Open findings`, and `NEXT`, including its owner actions.
Check `RELEASE.md` for pending delivery and verification; held work needs explicit scope restoration.

Refresh environment, rig, or account evidence when the next action depends on its current state.
Date historical observations and refresh them before using them to claim current state.

## After each batch

Apply the relevant [lifecycle conventions](../plan-lifecycle/SKILL.md):

- Update task status and index/TODO summaries, keeping detailed checklists in the owning task.
  Advance its date only for a [meaningful update](../plan-lifecycle/references/conventions.md#choosing-and-updating-a-task).
- Record verification and handoff in the plan's Validation Log, or TODO's VALIDATION for active
  work without a plan, with current evidence and invariants.
- Keep unresolved findings and a concrete next action in the owning task.
- Send durable mechanics to their tracked homes in the same commit and link them from the log.
- Put release state in `RELEASE.md` with its drain criterion, in the same commit as the `COMPLETED`
  entry. Use `COMPLETED` for implementation outcomes and `RELEASE.md` for release status.

## Committing

One commit per batch. Consolidation gets its own commit, after the detailed entries are committed.
Plan deletion gets its own commit, whose message names the plan.

## Reporting

When the loop ends, list every remaining entry and the single reason it was skipped: on-hold, blocked
by a named blocker, or owner-gated on a named decision. A reader should not have to open the index to
learn why you stopped.
