import { record, keysOnly, finite, identifier, readonlyCopy } from './validation.js';

/**
 * @typedef {Object} SessionEvent
 * @property {string} eventId Stable identity for exactly-once scoring within a session.
 * @property {string} sessionId
 * @property {string} type
 * @property {number} simTime Nonnegative simulation seconds.
 * @property {Object} payload Detached, readonly plain data.
 */
export function assertEvent(event, expectedSessionId) {
  record(event, 'SessionEvent');
  keysOnly(event, ['eventId', 'sessionId', 'type', 'simTime', 'payload'], 'SessionEvent');
  for (const key of ['eventId', 'sessionId', 'type']) identifier(event[key], key);
  finite(event.simTime, 'simTime', 0);
  record(event.payload, 'payload'); readonlyCopy(event.payload, 'payload');
  if (expectedSessionId !== undefined && event.sessionId !== expectedSessionId) throw new TypeError('Event sessionId does not match channel session');
  return event;
}

export function createEvent(value) {
  assertEvent(value);
  return readonlyCopy(value, 'SessionEvent');
}

/** No global bus. IDs are remembered until this session is disposed. */
export function createEventChannel(sessionId) {
  identifier(sessionId, 'sessionId');
  const listeners = new Set(); const seen = new Set(); let disposed = false;
  function live() { if (disposed) throw new Error('Event channel is disposed'); }
  return Object.freeze({
    emit(value) {
      live(); assertEvent(value, sessionId);
      if (seen.has(value.eventId)) return false;
      const event = createEvent(value);
      seen.add(event.eventId);
      // Subscriber errors propagate, allowing the owning clock/host to stop.
      for (const listener of [...listeners]) listener(event);
      return true;
    },
    subscribe(listener) {
      live();
      if (typeof listener !== 'function') throw new TypeError('listener must be a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() { if (disposed) return; disposed = true; listeners.clear(); seen.clear(); }
  });
}
