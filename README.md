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


# Production Hardening Proof Slice

## Risk
A failing PromptPilot dependency can cause repeated slow or unsuccessful requests, consuming resources and degrading service availability.

## Control
Implemented a circuit breaker with CLOSED, OPEN, and HALF-OPEN states. It stops forwarding requests after the configured failure threshold and permits a recovery probe after the cooldown.

## Run / Test
Run the project's documented test command. The expected result is that all circuit-breaker tests pass.

## Evidence
Automated tests verify normal operation, threshold-based opening, fast rejection while OPEN, and recovery after the cooldown.

## Observability
A `breaker_open_total` counter tracks breaker activations, and a structured `circuit_breaker_open` log event records the activation without sensitive request data.

## Trade-off
The circuit breaker introduces state management, cooldown configuration, and the possibility of temporarily rejecting requests while a dependency is recovering.

## Remaining Risk
The breaker does not fix the underlying dependency failure or guarantee that requests succeed. Timeouts, suitable fallback behavior, and dependency health monitoring remain necessary.

## How This Production Control Protects My Modules 1–3 Design
The circuit breaker protects the service's dependency boundary and availability assumptions by preventing repeated calls to an unhealthy dependency from exhausting resources.

## How to Verify
Run the documented automated tests and inspect the test output for successful assertions covering breaker activation, rejection, and recovery.