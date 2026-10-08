'use strict';

// Your task: implement a circuit breaker around PromptPilot's model provider.

class CircuitOpenError extends Error {
  constructor() {
    super('circuit is open');
    this.code = 'CIRCUIT_OPEN';
  }
}

function createCircuitBreaker(options = {}) {
  const failureThreshold = options.failureThreshold ?? 0.5;
  const minimumRequests = options.minimumRequests ?? 5;
  const openMillis = options.openMillis ?? 30_000;
  const now = options.now ?? Date.now;
  const onStateChange = options.onStateChange ?? function () {};

  const metrics = {
    breaker_open_total: 0,
    short_circuited_total: 0,
    success_total: 0,
    failure_total: 0
  };

  let state = 'CLOSED';
  let calls = 0;
  let failures = 0;
  let openedAt = null;
  let probeInProgress = false;

  function changeState(nextState) {
    if (state === nextState) {
      return;
    }

    state = nextState;

    if (state === 'OPEN') {
      metrics.breaker_open_total += 1;
      openedAt = now();
      probeInProgress = false;
    }

    if (state === 'HALF_OPEN') {
      probeInProgress = false;
    }

    onStateChange(state);
  }

  function resetCounts() {
    calls = 0;
    failures = 0;
  }

  function failureRate() {
    if (calls === 0) {
      return 0;
    }

    return failures / calls;
  }

  async function exec(fn) {
    if (state === 'OPEN') {
      const elapsed = now() - openedAt;

      if (elapsed < openMillis) {
        metrics.short_circuited_total += 1;
        throw new CircuitOpenError();
      }

      changeState('HALF_OPEN');
    }

    if (state === 'HALF_OPEN') {
      if (probeInProgress) {
        metrics.short_circuited_total += 1;
        throw new CircuitOpenError();
      }

      probeInProgress = true;

      try {
        const result = await fn();

        metrics.success_total += 1;

        probeInProgress = false;
        resetCounts();
        changeState('CLOSED');

        return result;
      } catch (error) {
        metrics.failure_total += 1;

        probeInProgress = false;
        changeState('OPEN');

        throw error;
      }
    }

    // CLOSED
    calls += 1;

    try {
      const result = await fn();

      metrics.success_total += 1;

      return result;
    } catch (error) {
      failures += 1;
      metrics.failure_total += 1;

      if (
        calls >= minimumRequests &&
        failureRate() >= failureThreshold
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
    }
  };
}

module.exports = {
  createCircuitBreaker,
  CircuitOpenError
};