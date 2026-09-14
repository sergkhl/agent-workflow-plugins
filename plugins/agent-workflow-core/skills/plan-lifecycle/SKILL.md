---
name: plan-lifecycle
description: Apply an adopted plan workflow when creating, registering, updating, or closing plans.
---

# Plan lifecycle

Use these conventions for the current task's plan creation, registration, progress updates, or
closure in a repository that has adopted this workflow. Reading a plan alone does not trigger a
maintenance sweep. Keep lifecycle actions within the user's scope and the host's mode.

Use the relevant sections of [conventions](references/conventions.md):

- Creating or registering work: coordination files, plan-less work, and status ownership.
- Recording a batch: ownership, release state, and Validation Log retention.
- Closing a plan: the exit test, preserving uncommitted evidence, and the deletion commit.
- Manual documentation hygiene: production-age retirement and proposals for inactive work.
- Adopting the workflow: setup in a new repository, only when the user requests adoption.

The plan owns design and acceptance while active; Git history preserves completed plans. Release
state belongs to the release manifest; administrative retirement does not prove behavior. Neither
convention grants production access, deployment, device verification, or destructive-operation authority.
