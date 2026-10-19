'use strict';

class CircuitOpenError extends Error {
  constructor() {
    super('circuit is open');
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
  }
}

function createCircuitBreaker(options = {}) {
  const failureThreshold = options.failureThreshold ?? 0.5;
  const minimumRequests = options.minimumRequests ?? 5;
  const openMillis = options.openMillis ?? 10000;
  const now = options.now ?? Date.now;
  const onStateChange = options.onStateChange ?? (() => {});

  if (
    failureThreshold < 0 ||
    failureThreshold > 1 ||
    minimumRequests < 1 ||
    !Number.isInteger(minimumRequests) ||
    openMillis < 0
  ) {
    throw new RangeError('Invalid circuit breaker configuration');
  }

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
  let probeInFlight = false;

  function transitionTo(nextState) {
    if (state === nextState) return;

    state = nextState;

    if (nextState === 'OPEN') {
      openedAt = now();
      probeInFlight = false;
      metrics.breaker_open_total += 1;
    }

    onStateChange(nextState);
  }

  async function exec(fn) {
    let isProbe = false;

    if (state === 'OPEN') {
      if (now() - openedAt < openMillis) {
        metrics.short_circuited_total += 1;
        throw new CircuitOpenError();
      }

      transitionTo('HALF_OPEN');
      probeInFlight = true;
      isProbe = true;
    } else if (state === 'HALF_OPEN') {
      // Only one request may test whether the dependency has recovered.
      if (probeInFlight) {
        metrics.short_circuited_total += 1;
        throw new CircuitOpenError();
      }

      probeInFlight = true;
      isProbe = true;
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
        probeInFlight = false;
        transitionTo('CLOSED');
      }

      return result;
    } catch (error) {
      metrics.failure_total += 1;

      if (isProbe) {
        transitionTo('OPEN');
      } else {
        failures += 1;

        if (
          calls >= minimumRequests &&
          failures / calls >= failureThreshold
        ) {
          transitionTo('OPEN');
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