---
name: docs-hygiene
description: Use $docs-hygiene to consolidate documentation into authoritative, useful definitions and procedures.
disable-model-invocation: true
---

# Documentation hygiene

Two sweeps over the same material. Run both; they catch different failures.

## Authorization boundary

Begin when the user names `$docs-hygiene` (including its namespaced form) or this skill path.
Continue that invocation through follow-up turns until completion, cancellation, or a scope change.
A repository mention does not activate a sweep. Apply it to the requested documentation set;
a repository-wide sweep requires that scope.

Deleting is the point, not a side effect — but **never delete a document that was never committed**.
Commit it first, then delete it in a later commit. Git history is the archive; content that exists
nowhere in history must not be deleted from anywhere.

## What to read

Start with the requested documents and their actual consumers. Follow links to the relevant
glossary, ADRs, plans, or runbooks when ownership or consistency depends on them. Do not expand a
scoped cleanup into an unrelated repository-wide reading itinerary.

## Sweep one — one canonical definition

Each architectural concept, decision, data model, interface contract, and implementation plan should
have **exactly one** canonical definition. For every duplicated or overlapping section, ask:

- Which document should be authoritative?
- Is each responsibility assigned to exactly one component?
- Are domain boundaries and dependency directions explicit?
- Is the same concept described differently across ADRs, plans, and TODOs?

Consolidate into the canonical location. Replace the repeated explanation with a link. Where two
documents genuinely conflict, do not pick the more convenient one — flag the conflict and the
ambiguous ownership for the owner to resolve.

The usual ownership split: an ADR owns durable policy and its reasoning; the repository instruction
file owns day-to-day mechanics; source types and the initial migration own persisted shapes; plans own
implementation sequencing. Each links to the others rather than restating them.

## Sweep two — traceable value or removal

Every retained architectural element and documentation section must be traceable to at least one of:

- a validated user or system requirement;
- a concrete downstream consumer;
- an invariant, risk, or non-functional requirement;
- an executable test, acceptance criterion, or operational need.

Classify each item as **Keep** (necessary and correctly scoped), **Simplify** (necessary but
over-designed), **Merge** (duplicates another responsibility or section), **Defer** (plausible future
value, not currently justified), or **Remove** (obsolete, contradictory, or low-value).

**Prefer deletion over preservation when no clear traceability exists.** Record unresolved decisions
explicitly rather than preserving speculative complexity — an open question belongs in a plan or a
`TODO` item, not in a document that reads as settled.

## Two things that always fail this sweep

- **An inventory a command can print** — available states, translation keys, table names, installed
  versions. A copied list goes stale silently. Reference the command instead.
- **A metric's trajectory.** One current value and its invariant, never the sequence that produced it.

## Output

Explain meaningful removals and consolidations, then complete the authorized cleanup. Ask only
when unresolved ownership or scope would change the result; do not require another approval for
an already authorized consolidation. Deletions get their own commit, whose message
names what was deleted and where its content now lives.
