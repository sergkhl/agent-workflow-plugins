# Deepening

Assess a cluster of modules through its responsibilities, callers, and dependencies. Use the
[design principles](references/design-principles.md) to evaluate the proposed boundary.

## Dependency categories

Dependency placement helps identify useful boundaries and appropriate verification. These categories
guide the assessment alongside cohesion and caller complexity.

### 1. In-process

Pure computation and in-memory state can share a module when their responsibilities are cohesive
and the combined interface simplifies callers. Test the resulting behaviour at a useful boundary.

### 2. Local-substitutable

Local stand-ins, such as an in-memory filesystem, can make dependency behaviour easier to exercise.
Choose their placement for the module's responsibilities; use the real dependency to verify behaviour
that the stand-in cannot represent.

### 3. Remote but owned (Ports & Adapters)

For owned services across a network, a port and transport adapter can separate domain logic from
delivery mechanics. In-memory adapters can exercise logic; integration checks establish the
transport contract when it is part of the change.

### 4. External services

Wrap third-party interactions when isolation or substitution improves the design. Fakes or mocks
can exercise local decisions; provider contract evidence supports claims about integration behaviour.

## Seam discipline

- Apply the [seam criteria](references/design-principles.md#principles) to the actual need. A single
  production adapter can justify a seam when it provides meaningful isolation.
- Keep internal seams within the implementation unless callers have a reason to depend on them.

## Testing across a refactor

- Compare existing and replacement tests by the behaviour and failure modes they cover.
- Retain focused tests that cover distinct behaviour or invariants, including useful internal tests.
- Retire redundant tests once equivalent coverage exists at the appropriate boundary.
- Assert caller-visible outcomes through the module's contract; give internal checks a concrete
  invariant or failure mode to verify.
