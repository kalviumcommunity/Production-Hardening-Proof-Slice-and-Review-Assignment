'use strict';

const { createCircuitBreaker, CircuitOpenError } = require('./circuitBreaker');

const FALLBACK_TEXT = 'Your ticket is queued for a human agent.';

function createReplyService(callProvider, options = {}) {
  const breaker = createCircuitBreaker(options);

  async function draftReply(ticket) {
    try {
      const text = await breaker.exec(() => callProvider(ticket));

      return {
        source: 'model',
        text,
      };
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        return {
          source: 'fallback',
          text: FALLBACK_TEXT,
          reason: 'circuit_open',
        };
      }

      return {
        source: 'fallback',
        text: FALLBACK_TEXT,
        reason: 'provider_error',
      };
    }
  }

  return {
    draftReply,
    breaker,
  };
}

module.exports = {
  createReplyService,
  FALLBACK_TEXT,
};