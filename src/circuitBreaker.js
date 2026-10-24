'use strict';

// Your task: implement a circuit breaker around PromptPilot's model provider.
//
// The supplied tests in test/circuitBreaker.test.js describe the exact behaviour.
// Do not modify the tests. Make them all pass.
//
// Requirements proven by the tests:
//   - Start in the CLOSED state. While CLOSED, count calls and failures.
//   - OPEN when (failures / calls) >= failureThreshold AND calls >= minimumRequests.
//   - While OPEN and within openMillis, SHORT-CIRCUIT: throw CircuitOpenError
//     WITHOUT calling fn, and increment metrics.short_circuited_total.
//   - After openMillis has elapsed (use the injected now()), allow ONE probe
//     call (HALF_OPEN). A successful probe -> CLOSED and reset the counts.
//     A failed probe -> OPEN again.
//   - Increment metrics.breaker_open_total every time you move to OPEN.
//   - Call options.onStateChange(state) on every state transition.
//
// Injected options (all optional, with sensible defaults):
//   failureThreshold, minimumRequests, openMillis, now, onStateChange

class CircuitOpenError extends Error {
  constructor() {
    super('circuit is open');
    this.code = 'CIRCUIT_OPEN';
  }
}

function createCircuitBreaker(options = {}) {
  const now = options.now ?? Date.now;
  const onStateChange = options.onStateChange ?? function () {};
  const failureThreshold = options.failureThreshold ?? 0.5;
  const minimumRequests = options.minimumRequests ?? 5;
  const openMillis = options.openMillis ?? 30_000;

  const metrics = {
    breaker_open_total: 0,
    short_circuited_total: 0,
    success_total: 0,
    failure_total: 0,
  };

  let state = 'CLOSED';
  let calls = 0;
  let failures = 0;
  let openedAt = 0;

  function transitionTo(nextState) {
    state = nextState;
    if (state === 'OPEN') {
      openedAt = now();
      metrics.breaker_open_total++;
    }
    onStateChange(state);
  }

  async function exec(fn) {
    if (state === 'OPEN') {
      if (now() - openedAt < openMillis) {
        metrics.short_circuited_total++;
        throw new CircuitOpenError();
      }
      transitionTo('HALF_OPEN');
    } else if (state === 'HALF_OPEN') {
      metrics.short_circuited_total++;
      throw new CircuitOpenError();
    }

    const isProbe = state === 'HALF_OPEN';
    if (!isProbe) {
      calls++;
    }

    let result;
    try {
      result = await fn();
    } catch (error) {
      metrics.failure_total++;
      if (isProbe) {
        transitionTo('OPEN');
      } else {
        failures++;
        if (
          calls >= minimumRequests &&
          failures / calls >= failureThreshold
        ) {
          transitionTo('OPEN');
        }
      }
      throw error;
    }

    metrics.success_total++;
    if (isProbe) {
      calls = 0;
      failures = 0;
      transitionTo('CLOSED');
    }
    return result;
  }

  return {
    exec,
    metrics,
    get state() {
      return state;
    },
  };
}

module.exports = { createCircuitBreaker, CircuitOpenError };
