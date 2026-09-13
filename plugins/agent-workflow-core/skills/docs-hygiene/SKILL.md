---
name: docs-hygiene
description: Use $docs-hygiene to consolidate documentation into authoritative, useful definitions and procedures.
disable-model-invocation: true
---

# Documentation hygiene

Review the requested documentation for clear ownership and current value. Cover both concerns in
the pass that best fits the material.

## Authorization boundary

Begin when the user names `$docs-hygiene` (including its namespaced form) or this skill path.
Continue that invocation through follow-up turns until completion, cancellation, or a scope change.
A repository mention does not activate a sweep. Apply it to the requested documentation set;
a repository-wide sweep requires that scope.

Preserve every document in Git before deleting it. Commit uncommitted content first, then delete it
in a later commit so the original remains retrievable.

## What to read

Start with the requested documents and their actual consumers. Follow links to the relevant
glossary, ADRs, plans, or runbooks when ownership or consistency depends on them.

## Canonical ownership

Each architectural concept, decision, data model, interface contract, and implementation plan should
have **exactly one** canonical definition. For every duplicated or overlapping section, ask:

- Which document should be authoritative?
- Is each responsibility assigned to exactly one component?
- Are domain boundaries and dependency directions explicit?
- Is the same concept described differently across ADRs, plans, and TODOs?

Consolidate into the canonical location and replace repeated explanations with links. Surface
substantive conflicts; ask the owner when authority or intended behaviour remains unresolved.

The usual ownership split: an ADR owns durable policy and its reasoning; the repository instruction
file owns day-to-day mechanics; source types and the initial migration own persisted shapes; plans own
implementation sequencing. Each links to the others rather than restating them.

## Current value

Every retained architectural element and documentation section must be traceable to at least one of:

- a validated user or system requirement;
- a concrete downstream consumer;
- an invariant, risk, or non-functional requirement;
- an executable test, acceptance criterion, or operational need.

Classify each item as **Keep** (necessary and correctly scoped), **Simplify** (necessary but
over-designed), **Merge** (duplicates another responsibility or section), **Defer** (plausible future
value, not currently justified), or **Remove** (obsolete, contradictory, or low-value).

Keep material that serves a current purpose, simplify or remove obsolete material, and record
unresolved decisions as open questions in the owning plan or `TODO` entry.

## Inventories and evidence

- Link current inventories to their authoritative command or definition.
- Keep operational summaries focused on current measurements and invariants. Retain historical
  evidence according to its owning workflow's purpose and retention rules.

## Output

Explain meaningful removals and consolidations, then complete the authorized cleanup. Ask only
when unresolved ownership or scope would change the result. Carry existing authorization through
the cleanup. Deletions get their own commit, whose message names what was deleted and where its
content now lives.
