# Codebase Design

Design **deep modules**: a lot of behaviour behind a small interface, placed at a clean seam, testable through that interface. Apply these criteria to the selected module design. The aim is leverage for callers, locality for maintainers, and testability for everyone.

## Glossary

Use these definitions to distinguish the design concepts. Keep the repository's vocabulary for
concrete objects; a service, API, or boundary may illustrate a concept without being its synonym.

**Module**: anything with an interface and an implementation, such as a function, class, package, service, or tier-spanning slice.

**Interface**: everything a caller must know to use the module correctly: the type signature, invariants, ordering constraints, error modes, required configuration, and performance characteristics. An API or type signature can express part of that contract.

**Implementation**: what's inside a module, its body of code. Distinct from **Adapter**: a thing can be a small adapter with a large implementation (a Postgres repo) or a large adapter with a small implementation (an in-memory fake). Reach for "adapter" when the seam is the topic; "implementation" otherwise.

**Depth**: leverage at the interface. The amount of behaviour a caller (or test) can exercise per unit of interface they have to learn. A module is **deep** when a large amount of behaviour sits behind a small interface, **shallow** when the interface is nearly as complex as the implementation.

**Seam** _(Michael Feathers)_: a place where you can alter behaviour without editing in that place; the *location* at which a module's interface lives. Where to put the seam is its own design decision, distinct from what goes behind it.

**Adapter**: a concrete thing that satisfies an interface at a seam. Describes *role* (what slot it fills), not substance (what's inside).

**Leverage**: what callers get from depth. More capability per unit of interface they learn. One implementation pays back across N call sites and M tests.

**Locality**: what maintainers get from depth. Change, bugs, knowledge, and verification concentrate in one place rather than spreading across callers. Fix once, fixed everywhere.

## Deep vs shallow

**Deep module** = small interface + lots of implementation:

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
└─────────────────────┘
```

**Shallow module** = large interface + little implementation:

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

Judge the design by cohesion and what its callers need to know. Useful questions include:

- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?

## Principles

- **Evaluate depth at the caller-facing interface.** Internal functions and seams can keep implementation responsibilities cohesive and support focused tests.
- **Evaluate what a wrapper owns.** Consider where its behaviour and complexity would move if it were removed. Keep boundaries that provide useful isolation or reduce caller knowledge.
- **Choose a useful test surface.** Test caller-visible behaviour through the module's contract. Focused internal tests can cover distinct invariants or failure modes.
- **Justify seams by their purpose.** Actual variation, dependency isolation, and useful test substitution can justify a seam. Weigh those benefits against the extra indirection.

## Designing for testability

Use the design's responsibilities to choose testable boundaries:

- Inject dependencies where substitution or isolation helps exercise meaningful behaviour.
- Separate pure decisions from necessary side effects. Make I/O and state changes explicit in the
  owning contract so tests can verify their outcomes and failures.
- Keep the interface focused on caller needs. Assess its complexity through real call sites and
  test setup, alongside the behaviour it supports.

## Relationships

- A **Module** presents an **Interface** to its callers and tests.
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.
