---
name: domain-modeling
description: Define or revise domain terminology and record consequential design decisions in the project’s glossary and ADRs.
---

# Domain Modeling

Apply when the task involves defining domain terms or settling durable design choices. Compare
the relevant glossary, code, and concrete scenarios. Resolve routine ambiguity from the available
evidence; ask the user when an unresolved meaning or conflict materially affects the design.

Use the repository's established vocabulary and record settled meanings in the owning context.
`CONTEXT.md` owns domain vocabulary; ADRs own consequential implementation decisions and reasoning.
Create files lazily when a resolved term or qualifying decision needs a recorded home.

- For glossary ownership, single- or multi-context layout, and term format, read
  [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md).
- For decisions worth recording, their ownership, numbering, and content, read
  [ADR-FORMAT.md](ADR-FORMAT.md).

Keep records within the authorized task and distinguish settled decisions from unresolved questions.
