---
name: plan-lifecycle
description: Use $plan-lifecycle to apply the adopted plan index, status ownership, closure, and retention conventions.
disable-model-invocation: true
---

# Plan lifecycle

Begin standalone lifecycle work only when the user names `$plan-lifecycle` (including its
namespaced form) or this skill path. The invocation persists through the same task's follow-ups.
`plan-from-tasks` and `drain-plans` may consult these conventions as documented helpers after their
own explicit invocation. Merely reading a plan does not authorize a lifecycle sweep.

Use the relevant sections of [conventions](references/conventions.md):

- Creating or registering work: the four files, plan-less work, and status altitudes.
- Recording a batch: ownership, release state, and Validation Log retention.
- Closing a plan: the exit test, preserving uncommitted evidence, and the deletion commit.
- Adopting the workflow: setup in a new repository, only when the user requests adoption.

The plan owns design and acceptance while active; Git history preserves completed plans. Release
state belongs to the release manifest and requires live evidence. Neither convention grants
production access, deployment, device verification, or destructive-operation authority.
