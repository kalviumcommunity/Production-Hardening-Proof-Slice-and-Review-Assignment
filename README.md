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

---

## Production Hardening Proof Slice Submission

### 1. Risk addressed
Prevents cascading failures, resource starvation, and latency spikes caused by continuously sending doomed calls to a degraded or unavailable downstream model provider.

### 2. Chosen control
Implemented a three-state circuit breaker (`CLOSED`, `OPEN`, `HALF_OPEN`) with threshold-based tripping, fast short-circuiting, and probe-based recovery in [`src/circuitBreaker.js`](./src/circuitBreaker.js), integrated into [`src/replyService.js`](./src/replyService.js).

### 3. How to run / test
Run `node --test` in the project root. Expected result: all 8 tests pass with zero failures.

### 4. Evidence
Unit tests in [`test/circuitBreaker.test.js`](./test/circuitBreaker.test.js) and integration tests in [`test/replyService.test.js`](./test/replyService.test.js) verify threshold detection, fast failure without calling the provider, probe recovery, and graceful fallback to queued human support (`reason: 'circuit_open'`).

### 5. Observability note
Exposes `metrics.breaker_open_total` (increments on trip/re-open), `metrics.short_circuited_total` (increments on blocked calls), and dispatches transitions (`OPEN`, `HALF_OPEN`, `CLOSED`) via `onStateChange(state)` without exposing sensitive payloads or tokens.

### 6. Trade-off
During the `openMillis` cooldown, requests are immediately short-circuited to fallback replies even if the upstream provider temporarily recovers before the next probe.

### 7. Remaining risk
In-memory counters and states are local to the current process instance and do not guard against slow upstream requests that hang without throwing an error (requires complementary timeout/deadline controls).

### 8. How this production control protects my Modules 1–3 design
Protects PromptPilot's asynchronous ticket processing pipeline and human-in-the-loop fallback mechanism from upstream model outages, preserving SLA responsiveness.
