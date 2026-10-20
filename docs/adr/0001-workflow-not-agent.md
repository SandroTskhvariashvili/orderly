# 1. A workflow with a model in it, not a free-roaming agent

Status: accepted

## Context

Order entry has a fixed shape. Every email needs the same things: who sent it, what they want, whether we can deliver it, and whether a person should look first. An open-ended agent that plans its own steps would add variance without adding anything the task needs.

## Decision

The pipeline is fixed: read, mask, sort, read the order, check, route, draft a reply. The model runs at two of those steps:

- **sort**, with a structured output
- **read the order**, with four read-only lookups

Everything else is ordinary code.

Inside "read the order" the model does choose its own lookups. That is the one place where judgement pays off: a customer writes "the oat one" or "Hafermilch", and only a search with the right words finds the product.

## Consequences

- The same email takes the same path every time. A routing decision can be replayed from the stored extraction without calling the model again.
- Each step is timed and priced on its own, so the audit trail shows exactly where time and money go.
- New checks are plain functions with unit tests, not prompt changes.
