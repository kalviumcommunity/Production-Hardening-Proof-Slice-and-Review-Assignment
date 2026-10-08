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

# Starter — Circuit Breaker Proof Slice (PromptPilot)

## Risk addressed

PromptPilot depends on an external model provider. Sustained provider failures could cause repeated doomed calls, increasing latency and spreading the failure to the service.

## Chosen control

Implemented a circuit breaker in `src/circuitBreaker.js`. It opens after the configured failure threshold, short-circuits calls while open, and uses a half-open probe to recover.

## How to run / test

Requires Node.js 18 or newer.

```bash
node --test