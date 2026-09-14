# The plan lifecycle

A plan owns a workstream's design and acceptance while active. Git history preserves completed
plans. Explicit repository policy overrides these defaults; reading a plan does not start hygiene.

## Coordination files

| File | Holds | Limit / empty state |
|---|---|---|
| `docs/plans/README.md` | Ordered active work and a separate On Hold section. | Index every retained plan as active or held. |
| `docs/plans/TODO.md` | `TODO` for active workstreams, `COMPLETED` outcomes, `VALIDATION` for active plan-less work. | At most 10 active workstreams; zero is valid. |
| `docs/plans/RELEASE.md` | Pending delivery or live verification, grouped by shipping surface. | `_None._` when settled. |

Owner actions belong to the owning plan or plan-less task. A repository may explicitly retain a
separate blocker file; never create or recreate one just because it is absent. Keep held work out
of TODO and the execution order. Task-less holds live in the index with a next action and resume
condition, not in a replacement backlog document.

## Choosing and updating a task

Keep work that fits in one TODO entry there. Write a plan when design, phasing, or acceptance needs
more than about 15 lines; list plan-less active work in the index by name with no link.

The task owns detailed status, acceptance, and owner actions. Its header is at most 15 lines; index
and TODO entries are short summaries and links, not repeated checklists. Keep them consistent after
batches. Record one `Last meaningful update: YYYY-MM-DD` in the owning task, including held tasks.
Implementation progress, new acceptance evidence, or a changed owner decision resets this date.
Formatting, rebases, and repeated unchanged blocker probes do not. Recover a missing date from
substantive history; leave it unknown when that history does not establish one.

## Document ownership

- ADRs own durable policy and reasoning. A plan owns its requirements and scope; link instead of
  repeating. Source types and migrations own implemented interfaces and persisted shapes.
- Verification and handoff belong in the plan's Validation Log. Durable mechanics belong in their
  tracked runbook, instruction, or test, with a pointer in the log.
- Keep machine-specific values in local artifacts. Tracked instructions describe discovery.

## Closing a plan

A plan can close as soon as all three exit conditions hold:

1. Every durable fact has a tracked home: policy in an ADR, procedure in a runbook, invariants in
   instructions or tests. A self-explaining executable guard is its own home.
2. Any remaining delivery fits a RELEASE entry with its next action and drain criterion. Before
   acceptance is retired under the policy below, keep a plan if multi-step acceptance still needs it.
3. Open findings are empty or each unresolved issue has a separate bounded task. Active successors
   live in TODO or a plan; held successors live in the index or a held plan. Never lose a known defect.

Explicit owner confirmation of production delivery and acceptance closes that scope immediately.
Manual hygiene also retires eligible acceptance by age as described below. Neither changes the
result of historical tests. Later issues become new tasks rather than reopening the retired checklist.

Preserve every document and validation record in Git before consolidating or deleting it. Commit
uncommitted content first, then consolidate or delete it in a later commit. A deletion is its own
commit, naming the document and the new home of retained content. Retrieve a deleted plan with
`git log --diff-filter=D -p -- docs/plans/<plan>.md`. Reconcile the index whenever a plan is removed.

## Manual hygiene and age

Apply this policy only during an explicitly invoked docs-hygiene pass covering planning or release
coordination, unless a repository explicitly chooses another trigger. Do not add scheduled work.

- Close original work whose relevant production delivery is recorded and more than seven days old;
  retire its remaining acceptance checklist. First create a separate bounded task for any known
  unresolved issue. Hygiene records that successor but does not start its implementation.
- Record the closure basis as owner-confirmed acceptance, verified behavior, or administrative
  retirement. Age retirement is not evidence that an unobserved test passed or that current
  production is healthy. A lack of traffic is not a successful behavior check.
- Use the earliest evidenced production delivery of the change on each relevant surface, with
  `Production since: <UTC date or timestamp>` and an evidence reference in its release entry.
  A dated observation that the change was already live establishes a conservative starting date.
  Commit/build/upload dates alone do not establish delivery. Unrelated redeploys do not reset age;
  a rollback or newer corrective change must be reconciled separately.
- Normalize timestamps to UTC and require elapsed time strictly greater than seven days. For
  date-only records, compare UTC calendar dates: seven days stays open, eight qualifies. Unknown
  delivery or dates stay unknown, in one compact unresolved entry per delivery group.
- Settle surfaces independently. Retain undelivered destinations and close the parent when its
  remaining delivery scope is settled; one store's delivery never proves another's.
- Propose moving unfinished work with no meaningful update for more than seven days on hold. Give
  its last substantive date, next action, and resume condition. Apply an already-authorized hold
  directly; otherwise present the proposal for an owner decision. Existing holds are not proposed
  again, and need explicit scope restoration before execution resumes.

## Release state

RELEASE holds delivery actions and short live drain criteria, grouped only when they share a
shipping action and evidence. Link procedures rather than repeating journeys. Deployment and
behavior are separate evidence; current live claims require authoritative current reads.

A release operator removes entries proved during an authorized deployment or reconciliation.
Manual hygiene may also remove owner-confirmed or age-retired entries under the policy above.
Keep dates and evidence pointers compact; detailed evidence and closure reasons belong in the
commit. COMPLETED records implementation outcomes, not a parallel release ledger.

## Validation Log retention

- Append within a phase; consolidate a closed phase to one entry with date, commits, current
  evidence, invariants, and handoff. Git preserves earlier detail; never consolidate uncommitted records.
- Keep one Open findings section. Remove resolved findings; re-home unresolved issues when closing.
- Validation Logs are at most about 350 lines. TODO is at most about 150 lines, COMPLETED is a rolling
  maximum of 10 short outcomes, and each active plan-less VALIDATION record is about 20 lines.
  Crossing a cap calls for consolidation before more content is added, not deletion of open work.

## Setting this up in a new repository

Only on requested adoption, create the three coordination files with the sections above and empty
states. Add concise hygiene comments with the applicable limits. Do not introduce a separate
blocker file unless the repository explicitly chooses one.
