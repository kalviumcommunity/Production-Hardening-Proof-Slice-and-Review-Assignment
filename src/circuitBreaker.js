
// Circuit breaker for PromptPilot's external model provider.
//
// CLOSED:
//   Requests are allowed and failures are counted.
//
// OPEN:
//   Requests are short-circuited for openMillis. The provider is not called.
//
// HALF_OPEN:
//   After openMillis, one probe request is allowed.
//   Successful probe -> CLOSED.
//   Failed probe -> OPEN.

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
  const onStateChange = options.onStateChange ?? function () {};

  const metrics = {
    breaker_open_total: 0,
    short_circuited_total: 0,
    success_total: 0,
    failure_total: 0,
  };

  let state = 'CLOSED';

  // Number of calls and failures while the breaker is CLOSED.
  let calls = 0;
  let failures = 0;

  // Timestamp at which the breaker entered OPEN.
  let openedAt = null;

  // Prevent more than one probe from running in HALF_OPEN.
  let probeInProgress = false;

  function changeState(newState) {
    if (state === newState) {
      return;
    }

    state = newState;
    onStateChange(state);

    if (state === 'OPEN') {
      metrics.breaker_open_total += 1;
      openedAt = now();
    }
  }

  function resetCounts() {
    calls = 0;
    failures = 0;
  }

  async function exec(fn) {
    // When OPEN, reject requests until openMillis has elapsed.
    if (state === 'OPEN') {
      const elapsed = now() - openedAt;

      if (elapsed < openMillis) {
        metrics.short_circuited_total += 1;
        throw new CircuitOpenError();
      }

      // The timeout has elapsed, so move to HALF_OPEN.
      // Only one probe is allowed.
      if (probeInProgress) {
        metrics.short_circuited_total += 1;
        throw new CircuitOpenError();
      }

      state = 'HALF_OPEN';
      probeInProgress = true;
      onStateChange(state);
    }

    // Count normal CLOSED requests.
    if (state === 'CLOSED') {
      calls += 1;
    }

    try {
      const result = await fn();

      metrics.success_total += 1;

      // A successful HALF_OPEN probe means the provider recovered.
      if (state === 'HALF_OPEN') {
        probeInProgress = false;
        resetCounts();
        changeState('CLOSED');
      }

      return result;
    } catch (err) {
      metrics.failure_total += 1;

      // A failed HALF_OPEN probe means the dependency is still unhealthy.
      if (state === 'HALF_OPEN') {
        probeInProgress = false;
        changeState('OPEN');
        throw err;
      }

      // Count failures while CLOSED.
      failures += 1;

      const failureRatio = failures / calls;

      // Open only after the minimum number of requests has been reached.
      if (
        calls >= minimumRequests &&
        failureRatio >= failureThreshold
      ) {
        changeState('OPEN');
      }

      throw err;
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

module.exports = {
  createCircuitBreaker,
  CircuitOpenError,
};

