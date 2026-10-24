# PromptPilot — Circuit Breaker Proof Slice

This implements **Option B (provided scenario)**: a circuit breaker around PromptPilot's external model-provider call.

## Risk addressed

Repeated provider failures can cause doomed calls to pile up and spread latency or errors across reply requests.

## Chosen control

The breaker in [`src/circuitBreaker.js`](./src/circuitBreaker.js) opens after the configured failure ratio and request volume are met; [`src/replyService.js`](./src/replyService.js) uses it to return a safe human-agent fallback and later test recovery with one probe.

## How to run / test

Run `node --test` (Node.js 18+); all circuit-breaker and reply-service tests should pass.

## Evidence

`test/circuitBreaker.test.js` proves threshold opening, no-call short-circuiting, successful recovery, failed-probe re-opening, and state-change callbacks; `test/replyService.test.js` proves fallback behavior.

## Observability note

`breaker_open_total`, `short_circuited_total`, `success_total`, and `failure_total` expose breaker activity; `onStateChange(state)` reports `OPEN`, `HALF_OPEN`, and `CLOSED` transitions without logging request contents.

## Trade-off

During an outage, some requests receive a queued-for-human response instead of a model draft, and the half-open state allows only one probe at a time.

## Remaining risk

The breaker is in-process and does not coordinate across instances; it also cannot prevent failures outside the protected provider call.

## How this production control protects my Modules 1–3 design

It protects the support-reply design by keeping reply handling available when the external model provider is unhealthy, without exposing ticket data in observability.
