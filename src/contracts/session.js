import { record, keysOnly, identifier } from './validation.js';

/**
 * @typedef {Object} ModeSession
 * @property {function():void} start
 * @property {function(string):void} pause
 * @property {function():void} resume
 * @property {function(number, import('./vehicle.js').InputFrame):void} step Seconds, fixed tick.
 * @property {function():Object} snapshot Detached readonly data.
 * @property {function():void} dispose Idempotent; stops owned resources, never owns RAF.
 * @property {function(Object=):void} [reset] Mode-specific reset extension used by T03/T04.
 */
/**
 * @callback ModeFactory
 * @param {ModeContext} context
 * @param {Object} options Mode-local options only.
 * @returns {Promise<ModeSession>} Importing the module itself never starts a session.
 */
/**
 * @typedef {Object} WorldService
 * @property {function(number):void} step Fixed seconds.
 * @property {function(Object):Object} query Bounds in metres; readonly road/signal/contact data.
 * @property {function(number):void} reset Seed.
 * @property {function():void} dispose
 */
/**
 * @typedef {Object} RendererHost
 * @property {function(Object, number):void} render Readonly snapshot, interpolation alpha 0..1.
 * @property {function(Object):void} resize CSS viewport size and pixel ratio.
 * @property {function():void} dispose Releases owned GPU resources; never changes physics.
 */
/**
 * @typedef {Object} InputService
 * @property {function():import('./vehicle.js').InputFrame} sample
 * @property {function():void} clear Releases every input source.
 * @property {function():void} dispose
 */
/**
 * @typedef {Object} SettingsStore
 * @property {function(string,string):Object} read Profile touch/desktop/hybrid, mode driving/simulation.
 * @property {function(string,string,Object):void} write Validated values, memory fallback on storage failure.
 */
/**
 * @typedef {Object} PursuitManager
 * @property {function(number,WorldService,Object):void} step Fixed seconds, world, readonly player.
 * @property {function():Object} snapshot Owned IDs/order/count/reinforcement clock.
 * @property {function():void} reset
 */
/**
 * @typedef {Object} ModeContext
 * @property {Object} clock Fixed clock; host owns its advancement and RAF.
 * @property {Object} input sample/clear/dispose.
 * @property {Object} settings read(profile,mode)/write(profile,mode,value).
 * @property {Object|function} world Service or deferred factory.
 * @property {Object|function} renderer Host or deferred factory.
 * @property {Object|function} audio Owned audio service; concrete methods are defined by T03.
 * @property {Object} events Session-bound emit/subscribe/dispose channel.
 * @property {AbortSignal} abortSignal
 * @property {string} sessionId
 */
function methods(value, names, label) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) throw new TypeError(`${label} must be a service`);
  for (const name of names) if (typeof value[name] !== 'function') throw new TypeError(`${label}.${name} must be a function`);
}

export function assertModeSession(value) {
  methods(value, ['start', 'pause', 'resume', 'step', 'snapshot', 'dispose'], 'ModeSession');
  if (value.reset !== undefined && typeof value.reset !== 'function') throw new TypeError('ModeSession.reset must be a function');
  return value;
}

export function assertModeContext(context) {
  record(context, 'ModeContext');
  keysOnly(context, ['clock', 'input', 'settings', 'world', 'renderer', 'audio', 'events', 'abortSignal', 'sessionId'], 'ModeContext');
  identifier(context.sessionId, 'sessionId');
  if (!context.abortSignal || typeof context.abortSignal.aborted !== 'boolean' || typeof context.abortSignal.addEventListener !== 'function') {
    throw new TypeError('abortSignal must be an AbortSignal-compatible value');
  }
  methods(context.clock, ['advance', 'pause', 'resume', 'reset', 'snapshot'], 'clock');
  methods(context.input, ['sample', 'clear', 'dispose'], 'input');
  methods(context.settings, ['read', 'write'], 'settings');
  if (typeof context.world !== 'function') methods(context.world, ['step', 'query', 'reset', 'dispose'], 'world');
  if (typeof context.renderer !== 'function') methods(context.renderer, ['render', 'resize', 'dispose'], 'renderer');
  methods(context.audio, [], 'audio');
  methods(context.events, ['emit', 'subscribe', 'dispose'], 'events');
  return context;
}

