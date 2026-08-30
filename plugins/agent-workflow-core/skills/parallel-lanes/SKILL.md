---
name: parallel-lanes
description: Explicit invocation only. Run the implementation units of one plan in more than one lane, with claims, lane write-ownership and an integration lane. Use only when the current prompt names $parallel-lanes or this skill path; never infer it from a plan with many units, a slow batch, or an idle agent.
disable-model-invocation: true
---

# Running work in more than one lane

A **lane** is one agent doing implementation work. The default is a single lane. This skill is the
whole exception, and it is the only place the lane protocol is defined.

## Authorization boundary

Proceed only when the current user prompt explicitly names `$parallel-lanes` or this skill path. A
plan with many units, a batch that is taking a long time, a free agent, or a repository instruction
that mentions lanes is the *subject* of this skill, never permission to run it.

This skill grants no gate it does not already own. Deployment, release, production access, device
verification, and destructive data operations each remain separately authorized. Two lanes do not
double what one lane was allowed to do.

## The default this overrides

Implementation units are **sequential and exclusive**: one lane, one unit at a time, in the order the
plan states. [`plan-lifecycle`](../plan-lifecycle/SKILL.md) owns that default. Everything below
applies only while this skill is running, and stops applying when it ends.

## A unit is claimable only when its plan declares it parallel-safe

The declaration lives in the owning plan and names three things:

- the **claim identifiers** it is compatible with — which other units may be in flight beside it;
- the **prerequisites already satisfied** — an unmet one makes the unit unclaimable, not merely
  risky;
- the **subsystem it owns** — what it may write.

A unit with no declaration is exclusive. Do not skip ahead to a later unit while an earlier one is
claimed: take a read-only review lane, or stop and say why.

## Who writes what

- A **worker lane** updates only the plan it owns, and never another lane's plan.
- The **integration lane** alone edits the plan index and `TODO.md`. One writer, so status at those
  altitudes cannot be left half-written by two lanes at once.
- A **review lane** is read-only. It reports; it does not edit.

Never copy a changing active-claim table into a plan or the index. A hand-maintained snapshot of live
state races the real registry and loses, and a reader cannot tell a stale copy from a current one.

## What this is not, yet

This skill defines a **convention**, not a runtime. It says who may claim, who may write, and what a
declaration must state. It does not define:

- where claims are recorded, or in what format;
- how a lane gets an isolated working copy;
- the order lanes integrate in, or who resolves a conflict between them.

Until those exist every claim is advisory, and a lane is an agreement between whoever is running it
rather than an enforced boundary — two lanes that each believe they are safe can still collide. Treat
an added lane as a cost carrying real risk and not as a free speedup: two is a decision, and a third
needs a reason beyond impatience.

Mechanism, when it arrives, fills in underneath this contract. The claim rules and write-ownership
above are what it has to implement, not something it replaces.
