# Design It Twice

Use when comparing alternative interfaces for a chosen module. Ground the comparison in the
user's constraints, actual callers, dependencies, and [design criteria](references/design-principles.md).
Consult [DEEPENING.md](DEEPENING.md) when dependency placement is part of the question.

Explore meaningfully different options, such as minimizing the interface or simplifying the most
common caller. Use enough alternatives to reveal a real tradeoff.
Independent designs may run in parallel when delegation is permitted and useful. Otherwise compare
them locally. Give any delegate the same relevant constraints and a distinct design objective.

For each option, show the interface contract, a caller example, hidden complexity, dependency
strategy, and tradeoffs. Compare locality, caller burden, and testability; recommend an option or
an explicitly justified combination. Honor the requested design scope before implementing.
