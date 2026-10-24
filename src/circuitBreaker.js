
'use strict';

class CircuitOpenError extends Error {
  constructor() {
    super('circuit is open');
    this.code = 'CIRCUIT_OPEN';
  }
}

function createCircuitBreaker(options = {}) {
  const failureThreshold = options.failureThreshold ?? 0.5;
  const minimumRequests = options.minimumRequests ?? 5;
  const openMillis = options.openMillis ?? 10000;
  const now = options.now ?? Date.now;
  const onStateChange = options.onStateChange ?? (() => {});

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

  function transition(nextState) {
    if (state === nextState) return;

    state = nextState;
    onStateChange(state);
    console.log(`[circuit-breaker] state=${state}`);
  }

  function openCircuit() {
    openedAt = now();
    metrics.breaker_open_total += 1;
    transition('OPEN');
  }

  async function exec(fn) {
    let isProbe = false;

    if (state === 'OPEN') {
      if (now() - openedAt < openMillis) {
        metrics.short_circuited_total += 1;
        throw new CircuitOpenError();
      }

      // Permit only one recovery probe.
      transition('HALF_OPEN');
      isProbe = true;
    } else if (state === 'HALF_OPEN') {
      metrics.short_circuited_total += 1;
      throw new CircuitOpenError();
    }

    if (!isProbe) {
      calls += 1;
    }

    try {
      const result = await fn();
      metrics.success_total += 1;

      if (isProbe) {
        calls = 0;
        failures = 0;
        transition('CLOSED');
      }

      return result;
    } catch (error) {
      metrics.failure_total += 1;

      if (isProbe) {
        openCircuit();
      } else {
        failures += 1;

        if (
          state === 'CLOSED' &&
          calls >= minimumRequests &&
          failures / calls >= failureThreshold
        ) {
          openCircuit();
        }
      }

      throw error;
    }
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
