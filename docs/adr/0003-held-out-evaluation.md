# 3. Publish only held-out numbers

Status: accepted

## Context

It is easy to tune prompts until a demo looks perfect on the emails you tuned it on. Those numbers say nothing about the next inbox.

## Decision

- 60 emails, each with a hand-written answer key (`data/labels`). The keys follow the same routing policy as the code, and `pnpm check:data` enforces it.
- 20 emails are the **dev** split. Prompts and checks were only ever tuned against these.
- 40 emails are the **test** split. They are run once at the end, and only their numbers are published.
- The headline metric is **wrong orders created**: emails turned into a draft that does not match what the customer asked for. It has to be zero. Every other metric is reported as measured, including the misses.

## Consequences

- The published numbers are lower than a tuned-on-test demo would show, and believable for that reason.
- Re-running `pnpm process && pnpm eval` reproduces them, within the variance of the model.
