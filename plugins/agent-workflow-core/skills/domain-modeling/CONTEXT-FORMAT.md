# CONTEXT.md Format

## Structure

```md
# {Context Name}

{Brief description of what this context is and why it exists.}

## Language

**Order**:
{The term's domain meaning and any distinction needed to use it correctly.}

**Invoice**:
A request for payment sent to a customer after delivery.

**Customer**:
A person or organization that places orders.
```

## Rules

- **Use established vocabulary.** Clarify ambiguous or legacy alternatives when the distinction matters locally.
- **Keep definitions concise.** State the domain meaning and include the qualifications needed to distinguish related concepts.
- **Document domain terms whose meaning matters in this context.** Put implementation details in their technical documentation or ADR.
- **Group terms under subheadings** when natural clusters emerge. If all terms belong to a single cohesive area, a flat list is fine.

## Single vs multi-context repos

**Single context (most repos):** One `CONTEXT.md` at the repo root.

**Multiple contexts:** A `CONTEXT-MAP.md` at the repo root lists the contexts, where they live, and how they relate to each other:

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md): receives and tracks customer orders
- [Billing](./src/billing/CONTEXT.md): generates invoices and processes payments
- [Fulfillment](./src/fulfillment/CONTEXT.md): manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

The skill infers which structure applies:

- If `CONTEXT-MAP.md` exists, read it to find contexts
- If only a root `CONTEXT.md` exists, single context
- If neither exists, create a root `CONTEXT.md` lazily when the first term is resolved

When multiple contexts exist, infer which one the current topic relates to. If unclear, ask.
