# Starter — Circuit Breaker Proof Slice (PromptPilot)

This is the starter repository for **Option B (provided scenario)** of the assignment.

Repository: `https://github.com/kalviumcommunity/Production-Hardening-Proof-Slice-and-Review-Assignment` (public, owned by
`kalviumcommunity`). Fork it, implement the breaker, and open a pull request back to your fork.

> The control here is a **circuit breaker**, covered earlier in this module. You are applying a
> concept you have already learned, not a new one.

## Scenario

PromptPilot drafts support replies by calling an external model provider. When the provider is slow
or failing, every request still tries it, so doomed calls pile up and the failure spreads. You will
add a **circuit breaker** so sustained failures short-circuit fast to a safe fallback, then recover
through a probe.

## Your task

Implement the circuit breaker in [`src/circuitBreaker.js`](./src/circuitBreaker.js). The file has a
skeleton and a `TODO`. The behaviour is fully specified by the supplied tests.

Prerequisite: Node.js 18 or newer (the tests use Node's built-in test runner). Then run:

```bash
node --test
```

Make **all tests pass**. Do **not** modify the tests. The reply path in `src/replyService.js` is
already wired to your breaker.

The breaker must:

- start `CLOSED` and count calls and failures;
- move to `OPEN` when `failures / calls >= failureThreshold` **and** `calls >= minimumRequests`;
- while `OPEN` and within `openMillis`, short-circuit (throw `CircuitOpenError` without calling the
  dependency) and increment `metrics.short_circuited_total`;
- after `openMillis` elapses (using the injected `now()`), allow one `HALF_OPEN` probe — success
  closes it and resets counts, failure re-opens it;
- increment `metrics.breaker_open_total` on every trip and call `onStateChange(state)` on every
  transition.

## What to submit

Open a pull request on a branch named `production-hardening-slice`, and in your README include these
labelled sections:

1. **Risk addressed**
2. **Chosen control**
3. **How to run / test**
4. **Evidence** (a reviewer can confirm it works without reading all your code)
5. **Observability note** (which metric moves and which state changes are logged)
6. **Trade-off**
7. **Remaining risk**
8. **How this production control protects my Modules 1–3 design**

Submit the pull-request URL.


## Risk addressed

When PromptPilot's external model provider fails repeatedly, requests can continue hitting the failing dependency and degrade service availability.

## Chosen control

Implemented a circuit breaker in `src/circuitBreaker.js` with CLOSED, OPEN, and HALF_OPEN states. It opens at the configured failure threshold, rejects calls during the cooldown, and permits one recovery probe.

## How to run / test

Run `node --test` from the repository root. Expected result: all supplied circuit-breaker and reply-service tests pass.

## Evidence

`test/circuitBreaker.test.js` verifies the failure threshold, short-circuiting without invoking the provider, successful recovery, failed-probe re-opening, and state-change notifications. `test/replyService.test.js` verifies the reply service integration.

## Observability note

The `breaker_open_total` and `short_circuited_total` counters expose breaker activations and rejected calls. The `onStateChange(state)` callback exposes transitions to CLOSED, OPEN, and HALF_OPEN so the caller can record them.

## Trade-off

The breaker adds state management and cooldown configuration. During an outage, requests may receive a fallback instead of a model-generated reply.

## Remaining risk

The breaker does not repair the provider, guarantee successful requests, or replace request timeouts. Production deployment should also configure timeouts and monitor provider health.

## How this production control protects my Modules 1–3 design

The breaker protects PromptPilot's external dependency boundary and preserves the reply workflow by preventing repeated calls to a failing provider. The existing reply service returns a safe fallback when the circuit is open or the provider fails.