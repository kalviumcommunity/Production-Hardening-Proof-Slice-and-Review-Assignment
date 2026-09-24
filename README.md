# Production Hardening Proof Slice — Circuit Breaker (PromptPilot)

## Scenario

PromptPilot drafts support replies through an external model provider. When the provider is slow or failing, repeated doomed calls can pile up and spread the failure.

## Risk addressed

It prevents repeated provider failures from consuming request capacity and spreading an outage through the reply path.

## Chosen control

`src/circuitBreaker.js` implements CLOSED/OPEN/HALF_OPEN thresholds, one recovery probe, counters, and state callbacks; `src/replyService.js` returns a safe fallback.

## How to run / test

Run `node --test`; the expected result is all supplied tests passing with zero failures.

## Evidence

`test/circuitBreaker.test.js` proves threshold opening, dependency-free short-circuiting, timed probing, recovery, and re-opening; `test/replyService.test.js` proves safe fallback behavior.

## Observability note

Trips increment `breaker_open_total`, short-circuits increment `short_circuited_total`, and `onStateChange` receives each `OPEN`, `HALF_OPEN`, and `CLOSED` transition.

## Trade-off

The breaker can serve fallback text instead of a fresh model draft during an outage and intentionally delays retries until the probe window.

## Remaining risk

This in-memory breaker is local to one process and does not coordinate across replicas or distinguish provider failure types.

## How this production control protects my Modules 1–3 design

It protects the earlier PromptPilot decision to keep the support-reply path available with a human-agent fallback instead of allowing the model dependency to become a single-point outage.
