
# Production Hardening Proof Slice — PromptPilot

## 1. Risk addressed
When the external model provider repeatedly fails, requests can keep calling it and increase latency. The circuit breaker stops repeated calls during an outage.

## 2. Chosen control
Implemented a circuit breaker in `src/circuitBreaker.js` with CLOSED, OPEN and HALF_OPEN states. The existing reply service uses it to return a safe fallback.

## 3. How to run / test
Requires Node.js 18 or newer. Run `node --test` from the repository root. Expected result: all supplied tests pass.

## 4. Evidence
The automated tests verify that the breaker opens after the failure threshold, blocks provider calls while OPEN, allows a recovery probe, closes on probe success and reopens on probe failure.

## 5. Observability note
The metrics `breaker_open_total`, `short_circuited_total`, `success_total` and `failure_total` track behavior. State transitions are reported through `onStateChange` and logged without request payloads or secrets.

## 6. Trade-off
Requests may receive a fallback while the provider is temporarily unavailable, even if a subsequent provider request might have succeeded.

## 7. Remaining risk
This implementation keeps breaker state in process memory. It does not coordinate state across multiple service instances or guarantee provider recovery.

## 8. How this production control protects my Modules 1–3 design
It protects the design decision to use an external model provider by preventing repeated calls during sustained failures and preserving a fallback path for support replies.
