# ADR Format

Use the repository's adopted ADR location. A single-context repository normally uses `docs/adr/`;
in a multi-context repository, use the owning context's ADR directory, with root `docs/adr/` for
system-wide decisions. Use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create the relevant directory lazily when the first qualifying decision needs a recorded home.

## Template

```md
# {Short title of the decision}

{Briefly state the context, decision, and reasoning.}
```

An ADR can be a single paragraph that makes the decision and its reasoning clear.

## Optional sections

Include these when they help a future reader assess the decision:

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`): useful when decisions are revisited
- **Considered Options**: only when the rejected alternatives are worth remembering
- **Consequences**: only when non-obvious downstream effects need to be called out

## Numbering

Scan the owning ADR directory for the highest existing number and increment by one.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, or deployment target choices with meaningful replacement costs.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only."
- **Deliberate deviations from the expected approach.** Record the constraint or tradeoff that explains the choice.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Consequential alternatives.** Record why a plausible alternative was rejected when that reasoning will matter to future decisions.
