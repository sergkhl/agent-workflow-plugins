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

If a batch turns out blocked part-way, record the blocker in the owning plan's `Open findings`, or in
`docs/plans/BLOCKERS.md` when only the owner can clear it, and move to the next actionable entry
rather than halting.

Size each batch by complexity and coupling. Read the current plan and its relevant dependencies.
Implementation units are sequential and exclusive.

## Resuming

Resume each plan from its own status header, `Open findings`, and `NEXT`. Check `BLOCKERS.md` for
owner actions and `RELEASE.md` for committed changes awaiting live verification.

Refresh environment, rig, or account evidence when the next action depends on its current state.
Date historical observations and refresh them before using them to claim current state.

## After each batch

Apply the relevant [lifecycle conventions](../plan-lifecycle/SKILL.md):

- Update the three status altitudes: plan header, index entry, `TODO.md` entry.
- Record verification and handoff in the plan's Validation Log, with current evidence and invariants.
- Put anything unresolved in the plan's single `Open findings` with a concrete next action.
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
