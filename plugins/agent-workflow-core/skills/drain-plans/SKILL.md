---
name: drain-plans
description: Use $drain-plans to implement the ordered plan index in validated, committed batches until nothing is actionable.
disable-model-invocation: true
---

# Drain the execution order

Take the **whole** index, not one entry.

## Authorization boundary

Begin when the user names `$drain-plans` (including its namespaced form) or this skill path.
The invocation continues across follow-up turns until completion, cancellation, or a scope change.
A mention in a plan, repository instruction, or another workflow does not activate it.
Consulting [plan-lifecycle](../plan-lifecycle/SKILL.md) is a required helper within this scope and
does not require another user invocation. User instructions take precedence over skill defaults.

This skill does not grant any gate it does not already own. Deployment, release, production access,
device or simulator verification, and destructive data operations each remain separately authorized —
a plan listing a manual gate records that the gate is pending, it does not open it. If a batch needs
one, record it as pending and move on.

## The loop

```
read the index → take the top actionable entry → implement a batch → validate →
persist status → commit → re-read the index → repeat
```

**Carry on past a finished batch into the next batch, and past a closed plan into the next plan.**
Never stop to ask what is next. Stop only when every remaining entry is on-hold, blocked, or
owner-gated — then name each one skipped and why.

If a batch turns out blocked part-way, record the blocker in the owning plan's `Open findings`, or in
`docs/plans/BLOCKERS.md` when only the owner can clear it, and move to the next actionable entry
rather than halting.

Size each batch by complexity and coupling, not by count. Keep context lean: read the plan you are
working, not every plan. Implementation units are sequential and exclusive.

## Resuming

Resume each plan from **its own** status header, `Open findings` and `NEXT` — not from `TODO.md`
alone, which is written at a different altitude and lags. Check `BLOCKERS.md` for what only the owner
can do, and `RELEASE.md` for what is committed but not verified live.

Refresh environment, rig, or account evidence when the next action depends on its current state.
An earlier observation remains historical evidence, not a current deployment or runtime watermark.

## After each batch

Apply the relevant [lifecycle conventions](../plan-lifecycle/SKILL.md):

- Update the three status altitudes: plan header, index entry, `TODO.md` entry.
- Add evidence to the plan's Validation Log — what was proved, and the invariants a re-run must not
  break. Never a metric's trajectory.
- Put anything unresolved in the plan's single `Open findings` with a concrete next action.
- Send durable mechanics to their tracked homes in the same commit, never into a log.
- Put release state in `RELEASE.md` with its drain criterion, in the same commit as the `COMPLETED`
  entry. A `COMPLETED` entry never states release status.
- Never open a handoff or status file beside a plan.

Nothing machine-specific — home paths, serials, device ids, personal accounts — enters a tracked file.

## Committing

One commit per batch. Consolidation gets its own commit, after the detailed entries are committed.
Plan deletion gets its own commit, whose message names the plan.

## Reporting

When the loop ends, list every remaining entry and the single reason it was skipped: on-hold, blocked
by a named blocker, or owner-gated on a named decision. A reader should not have to open the index to
learn why you stopped.
