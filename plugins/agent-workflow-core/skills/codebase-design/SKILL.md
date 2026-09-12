---
name: codebase-design
description: Design module interfaces and seams for encapsulation, locality, and testability.
---

# Codebase design

Use for module design and architectural refactoring, or as a documented helper for that work.
Keep the user's scope and the project's domain vocabulary. Prefer a small interface that hides
meaningful complexity and concentrates changes and tests.

- For terminology and design criteria, consult [design principles](references/design-principles.md).
- For a coupled cluster and its dependencies, consult [DEEPENING.md](DEEPENING.md).
- For requested alternative interfaces, consult [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md).

Choose the reference that changes the current decision. These are design criteria, not a mandate
to redesign neighboring modules or impose a vocabulary on unrelated work.
