# The plan lifecycle

A plan owns a workstream's design and acceptance while active. Delete it when its exit test passes;
Git history preserves completed plans.

## The four files

| File | Holds | Empty state |
|---|---|---|
| `docs/plans/README.md` | The ordered execution index. Every plan file appears here, ordered by value per unit of effort. Blocked items keep their merit position and say so. | — |
| `docs/plans/TODO.md` | `TODO` (3–10 current workstreams), `COMPLETED` (rolling, ≤10 outcomes), `VALIDATION` (active plan-less work). | — |
| `docs/plans/RELEASE.md` | One line per change committed but **not yet verified live**, grouped by shipping surface, each with its drain criterion. | `_None._` |
| `docs/plans/BLOCKERS.md` | Unresolved manual actions only the owner can take. | `_None._` |

Index every plan file. Reconcile the directory with the index whenever a plan is added or deleted.

## Choosing a plan or a TODO entry

Keep work that fits in one `TODO.md` entry there. Write a plan when the work needs more room for
design, phasing, or acceptance criteria.
List plan-less work in the execution order by name, with no link. A `TODO` item that outgrows ~15
lines has earned a plan file.

## Three status altitudes

The same status is written in the plan header (≤15 lines), the index entry (≤5 lines), and the
`TODO.md` entry (≤10 lines). Keep each at its own altitude. After every batch, update all three.

## Document ownership

- An ADR owns durable policy and its reasoning. A plan owns its own requirements and scope. Plans
  link rather than restate.
- Record verification, handoff, and detailed status in the owning plan's Validation Log.
- Durable mechanics — rig gotchas, operational procedure, code invariants — go to their tracked homes
  in the same commit that discovers them, with a pointer left in the log.
- Keep machine-specific values in local artifacts. Tracked instructions describe how to discover
  paths, devices, and accounts.

## Closing a plan

Delete a plan when all three parts of its exit test hold:

1. **Every durable fact has a tracked home.** Policy → an ADR; code invariants → the repository
   instructions or a test that fails without them; procedure → the relevant runbook or skill. A guard
   that explains itself when it fires is its own home.
2. **Everything a deployer still needs fits its `RELEASE.md` line**, including that line's drain
   criterion. Keep the plan open when remaining acceptance needs detail beyond that line, and state
   what it still owns. Pending release alone can live in the manifest line.
3. **`Open findings` is `_None._`**, or every line has been re-homed to a `TODO.md` item in the same
   commit. The receiving TODO entry owns each remaining finding.

Deleting is a commit of its own, whose message names the plan. Retrieval is
`git log --diff-filter=D -p -- docs/plans/<plan>.md`.

Preserve every plan and validation record in Git before deleting it. Commit an untracked plan first,
even when its work is already done, then delete it in a later commit.

## Release state

`RELEASE.md` owns pending live verification for changes to shipping surfaces. Each line gives the
release operator the change, relevant operational constraints, and its drain criterion. ADRs own
rationale; plans and TODO entries own implementation work and findings.

- Use `COMPLETED` for implementation outcomes and `RELEASE.md` for release status. Record pending
  live verification in the same commit as the corresponding `COMPLETED` entry.
- Every drain criterion names an achievable observation that proves the change is live and correct.
  For manual verification, name the gate and the item that owns the session.
- The release operator reads current evidence from the authoritative deployed system and removes
  entries whose criteria are satisfied in the same session.

## Validation Log retention

- **Append-only within a phase, rewritten when that phase closes.** A closed phase leaves **one**
  entry: date, commits, what is proved, the invariants a re-run must not break, what it hands off.
  Aim for under a screen.
- **Keep current measurements.** Record each metric's current value and invariant, plus which checks
  passed or remain pending. Git history preserves earlier entries.
- **One `Open findings` section per plan**, at the end. A pass that finds something appends there; the
  pass that closes it deletes the line.
- **Caps.** Validation Log ≤ ~350 lines; `TODO.md` ≤ ~150 lines whole-file. Crossing a cap means
  consolidation is due **before** anything new is appended. Consolidate in its own commit, after the
  detailed entries are committed. Consolidate only content already preserved in Git.

## Setting this up in a new repository

Create the four files with the sections above and nothing in them, `RELEASE.md` and `BLOCKERS.md` at
`_None._`. Add a hygiene comment at the top of each naming its caps, so whoever opens one to append
sees the rules without coming here. Then write the first plan with `plan-from-tasks`.
