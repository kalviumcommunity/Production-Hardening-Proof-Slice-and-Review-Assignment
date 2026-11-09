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
  const openMillis = options.openMillis ?? 30000;
  const now = options.now ?? Date.now;
  const onStateChange = options.onStateChange ?? function () {};

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
  let probeInProgress = false;

  function changeState(newState) {
    if (state === newState) return;

    state = newState;

    if (state === 'OPEN') {
      metrics.breaker_open_total++;
      openedAt = now();
    }

    onStateChange(state);
  }

  function rejectRequest() {
    metrics.short_circuited_total++;
    throw new CircuitOpenError();
  }

  async function exec(fn) {
    // Handle requests while the circuit is OPEN.
    if (state === 'OPEN') {
      if (now() - openedAt < openMillis) {
        rejectRequest();
      }

      // Recovery period has elapsed. Move to HALF_OPEN.
      changeState('HALF_OPEN');
    }

    // Allow only one recovery probe in HALF_OPEN.
    if (state === 'HALF_OPEN') {
      if (probeInProgress) {
        rejectRequest();
      }

      probeInProgress = true;

      try {
        const result = await fn();

        metrics.success_total++;

        // Successful probe: close the circuit and reset counters.
        changeState('CLOSED');
        calls = 0;
        failures = 0;

        return result;
      } catch (error) {
        metrics.failure_total++;

        // Failed probe: open the circuit again.
        changeState('OPEN');

        throw error;
      } finally {
        probeInProgress = false;
      }
    }

    // Normal request while CLOSED.
    calls++;

    try {
      const result = await fn();
      metrics.success_total++;
      return result;
    } catch (error) {
      metrics.failure_total++;
      failures++;

      const failureRate = failures / calls;

      if (
        calls >= minimumRequests &&
        failureRate >= failureThreshold &&
        state === 'CLOSED'
      ) {
        changeState('OPEN');
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