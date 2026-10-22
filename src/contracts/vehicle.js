import { record, keysOnly, finite, boolean, integer, readonlyCopy } from './validation.js';

/**
 * @typedef {Object} InputFrame
 * @property {number} throttle 0..1; forward drive only.
 * @property {number} brake 0..1; overrides both drive directions.
 * @property {number} [reverseThrottle] 0..1, defaults to 0. T06 owns the stop interlock.
 * @property {number} steer -1 left .. +1 right.
 * @property {boolean} boost
 * @property {boolean} hover
 * @property {boolean} kickflip
 */
const INPUT_DEFAULTS = Object.freeze({ throttle: 0, brake: 0, reverseThrottle: 0, steer: 0, boost: false, hover: false, kickflip: false });
const INPUT_KEYS = Object.keys(INPUT_DEFAULTS);

/** Validate a sampled frame. Older frames may omit reverseThrottle. */
export function assertInputFrame(frame) {
  record(frame, 'InputFrame'); keysOnly(frame, INPUT_KEYS, 'InputFrame');
  for (const key of ['throttle', 'brake', 'reverseThrottle']) {
    finite(key === 'reverseThrottle' && !Object.hasOwn(frame, key) ? 0 : frame[key], key, 0, 1);
  }
  finite(frame.steer, 'steer', -1, 1);
  for (const key of ['boost', 'hover', 'kickflip']) boolean(frame[key], key);
  const reverse = frame.reverseThrottle ?? 0;
  if ((frame.brake > 0 && (frame.throttle > 0 || reverse > 0)) || (frame.throttle > 0 && reverse > 0)) {
    throw new TypeError('InputFrame drive/brake conflict');
  }
  return frame;
}

/** Validate raw channels, then apply explicit brake/neutral arbitration. */
export function createInputFrame(value = {}) {
  record(value, 'InputFrame'); keysOnly(value, INPUT_KEYS, 'InputFrame');
  const frame = { ...INPUT_DEFAULTS, ...value };
  // Validate all raw channels before resolving; invalid values must not disappear.
  for (const key of ['throttle', 'brake', 'reverseThrottle']) finite(frame[key], key, 0, 1);
  finite(frame.steer, 'steer', -1, 1);
  for (const key of ['boost', 'hover', 'kickflip']) boolean(frame[key], key);
  if (frame.brake > 0 || (frame.throttle > 0 && frame.reverseThrottle > 0)) {
    frame.throttle = 0; frame.reverseThrottle = 0;
  }
  return Object.freeze(frame);
}

/**
 * @typedef {Object} SwipeFrame
 * @property {number} horizontal -1..1, right positive.
 * @property {number} vertical -1..1, up positive (not DOM clientY).
 * @property {boolean} active
 * @property {number|null} pointerId Null when inactive; no automatic promotion.
 */
export function assertSwipeFrame(frame) {
  record(frame, 'SwipeFrame'); keysOnly(frame, ['horizontal', 'vertical', 'active', 'pointerId'], 'SwipeFrame');
  finite(frame.horizontal, 'horizontal', -1, 1); finite(frame.vertical, 'vertical', -1, 1);
  boolean(frame.active, 'active');
  if (frame.active) integer(frame.pointerId, 'pointerId');
  else if (frame.horizontal !== 0 || frame.vertical !== 0 || frame.pointerId !== null) {
    throw new TypeError('SwipeFrame must be neutral and have pointerId=null when inactive');
  }
  return frame;
}

export function createSwipeFrame(value = {}) {
  record(value, 'SwipeFrame');
  const frame = { horizontal: 0, vertical: 0, active: false, pointerId: null, ...value };
  assertSwipeFrame(frame);
  return Object.freeze(frame);
}

/** @typedef {{x:number,y:number,z:number}} Vector3SI Metres or metres/second, as named. */
/** @typedef {{x:number,y:number,z:number,w:number}} Quaternion Unit quaternion. */
/**
 * @typedef {Object} WheelSnapshot
 * @property {'FL'|'FR'|'RL'|'RR'} id Fixed wheel order.
 * @property {Vector3SI} position World position in metres.
 * @property {number} angularVelocity Radians/second, signed for reverse.
 * @property {boolean} contact
 * @property {number} normalForce Newtons, zero when not in contact.
 * @property {Quaternion} [rotation]
 */
/**
 * @typedef {Object} VehicleSnapshot
 * @property {Vector3SI} position Metres.
 * @property {Quaternion} rotation
 * @property {Vector3SI} velocity Metres/second.
 * @property {Vector3SI} angularVelocity Radians/second.
 * @property {Array<WheelSnapshot|null>} wheels FL/FR/RL/RR; null explicitly means unmodelled.
 * @property {Object} damage Mode-owned plain finite data, not shared mutable state.
 * @property {Object} telemetry Plain finite SI data; display converts to km/h or mph.
 */
/**
 * @typedef {Object} VehicleModel
 * @property {function(Object):void} reset Initial SI state.
 * @property {function(number,InputFrame,Object):void} step Fixed seconds, input, numeric environment.
 * @property {function():VehicleSnapshot} snapshot Detached readonly output, no engine objects.
 */
export const WHEEL_IDS = Object.freeze(['FL', 'FR', 'RL', 'RR']);
function vector(value, label) {
  record(value, label); keysOnly(value, ['x', 'y', 'z'], label);
  for (const key of ['x', 'y', 'z']) finite(value[key], `${label}.${key}`);
}
function quaternion(value, label) {
  record(value, label); keysOnly(value, ['x', 'y', 'z', 'w'], label);
  for (const key of ['x', 'y', 'z', 'w']) finite(value[key], `${label}.${key}`);
  if (Math.abs(Math.hypot(value.x, value.y, value.z, value.w) - 1) > 1e-6) throw new TypeError(`${label} must be a unit quaternion`);
}

export function assertVehicleSnapshot(value) {
  record(value, 'VehicleSnapshot');
  keysOnly(value, ['position', 'rotation', 'velocity', 'angularVelocity', 'wheels', 'damage', 'telemetry'], 'VehicleSnapshot');
  for (const key of ['position', 'velocity', 'angularVelocity']) vector(value[key], key);
  quaternion(value.rotation, 'rotation');
  if (!Array.isArray(value.wheels) || value.wheels.length !== 4) throw new TypeError('wheels must have four ordered slots');
  for (let i = 0; i < 4; i++) {
    const wheel = value.wheels[i];
    if (wheel === null) continue;
    record(wheel, `wheels[${i}]`);
    keysOnly(wheel, ['id', 'position', 'angularVelocity', 'contact', 'normalForce', 'rotation'], 'wheel');
    if (wheel.id !== WHEEL_IDS[i]) throw new TypeError('wheel id/order mismatch');
    vector(wheel.position, 'wheel.position'); finite(wheel.angularVelocity, 'wheel.angularVelocity');
    boolean(wheel.contact, 'wheel.contact'); finite(wheel.normalForce, 'wheel.normalForce', 0);
    if (!wheel.contact && wheel.normalForce !== 0) throw new TypeError('non-contact wheel normalForce must be zero');
    if (wheel.rotation !== undefined) quaternion(wheel.rotation, 'wheel.rotation');
  }
  record(value.damage, 'damage'); record(value.telemetry, 'telemetry');
  readonlyCopy(value.damage, 'damage'); readonlyCopy(value.telemetry, 'telemetry');
  return value;
}

export function createVehicleSnapshot(state) {
  assertVehicleSnapshot(state);
  return readonlyCopy(state, 'VehicleSnapshot');
}
