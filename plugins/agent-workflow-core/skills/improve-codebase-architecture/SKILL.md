---
name: improve-codebase-architecture
description: Use $improve-codebase-architecture to identify module deepening opportunities and explore a selected candidate.
disable-model-invocation: true
---

# Improve codebase architecture

Begin when the user names `$improve-codebase-architecture` (including its namespaced form) or this
skill path; continue the same invocation through follow-up turns. Deliver a visual report of useful
module deepening opportunities, then explore the user's chosen candidate. Implementation requires
an implementation request.

## Find useful candidates

Start with the user's named area or pain point. When none is named, use recent change history to
choose likely sources of friction. Consult the relevant domain terms and ADRs and use
[codebase-design](../codebase-design/SKILL.md) for the design criteria. Keep the project's vocabulary;
architectural vocabulary should clarify the proposal, not ban familiar words.

Look for complexity spread across callers, interfaces that expose implementation choices, and
changes or tests that require crossing too many files. Test whether removing a suspected wrapper
actually removes complexity or merely pushes it to callers. Delegate a bounded independent lookup
only when useful and permitted.

## Present the report

Use [HTML-REPORT.md](HTML-REPORT.md) when producing the default self-contained HTML report in the
OS temporary directory; adapt its example scaffold to the findings and available rendering tools.
Honor a user-specified format. Each candidate needs affected files, observed friction, proposed
change, benefits, a useful before/after visual, recommendation strength, and any substantive ADR
conflict. End with your recommendation. Show the artifact through the host's supported preview.

Let the user select a candidate before detailed interface design. If the request already selects
one, proceed with it instead of asking again.

## Explore the selected candidate

Use [grilling](../grilling/SKILL.md) for consequential choices and
[domain-modeling](../domain-modeling/SKILL.md) for resolved terminology and durable tradeoffs.
These helpers are within this invocation's design scope. Record meaningful decisions in their
adopted homes; avoid creating documents for temporary preferences. For requested interface
alternatives, use [Design It Twice](../codebase-design/DESIGN-IT-TWICE.md).
