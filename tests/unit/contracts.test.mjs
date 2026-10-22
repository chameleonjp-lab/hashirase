import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionalModule, required, vehicleState } from '../support/foundation.mjs';

const vehicle = await optionalModule('src/contracts/vehicle.js');
const session = await optionalModule('src/contracts/session.js');
const events = await optionalModule('src/contracts/events.js');

test('input_frame_rejects_invalid_values_and_defaults_reverse_throttle', () => {
  const create = required(vehicle, 'createInputFrame');
  assert.deepEqual(create(), { throttle: 0, brake: 0, reverseThrottle: 0, steer: 0, boost: false, hover: false, kickflip: false });
  for (const field of ['throttle', 'brake', 'reverseThrottle']) {
    for (const bad of [-0.01, 1.01, NaN, Infinity, '1', null]) assert.throws(() => create({ [field]: bad }), /throttle|brake|reverseThrottle/);
  }
  for (const bad of [-2, 2, NaN, '0']) assert.throws(() => create({ steer: bad }), /steer/);
  for (const field of ['boost', 'hover', 'kickflip']) assert.throws(() => create({ [field]: 1 }), /boolean/);
  assert.throws(() => create({ arbitrary: 1 }), /arbitrary|unknown/);
  assert.throws(() => create(null), /object/);
  const original = { throttle: 0.5, steer: -0.3 };
  const result = create(original);
  original.throttle = 1;
  assert.equal(result.throttle, 0.5);
  assert(Object.isFrozen(result));
});

test('input_frame_resolves_drive_conflicts_without_reverse_force_during_braking', () => {
  const create = required(vehicle, 'createInputFrame');
  assert.equal(create({ throttle: 1, reverseThrottle: 1 }).throttle, 0);
  assert.equal(create({ throttle: 1, reverseThrottle: 1 }).reverseThrottle, 0);
  const braking = create({ throttle: 1, brake: 0.2, reverseThrottle: 1, steer: 0.5 });
  assert.deepEqual([braking.throttle, braking.reverseThrottle, braking.brake, braking.steer], [0, 0, 0.2, 0.5]);
  const assertFrame = required(vehicle, 'assertInputFrame');
  assert.throws(() => assertFrame({ ...create(), throttle: 1, reverseThrottle: 1 }), /conflict/);
  assert.throws(() => assertFrame({ ...create(), throttle: 0.1, brake: 0.1 }), /conflict/);
  // Speed-dependent reverse interlock belongs to T06, not the data contract.
});

test('swipe_frame_has_right_positive_up_positive_axes_and_pointer_ownership', () => {
  const create = required(vehicle, 'createSwipeFrame');
  assert.deepEqual(create(), { horizontal: 0, vertical: 0, active: false, pointerId: null });
  assert.deepEqual(create({ horizontal: 1, vertical: 1, active: true, pointerId: 7 }), { horizontal: 1, vertical: 1, active: true, pointerId: 7 });
  for (const field of ['horizontal', 'vertical']) {
    for (const bad of [-1.1, 1.1, NaN, Infinity, '0']) assert.throws(() => create({ [field]: bad, active: true, pointerId: 1 }), new RegExp(field));
  }
  for (const bad of [null, -1, 1.5, '1', Infinity]) assert.throws(() => create({ active: true, pointerId: bad }), /pointerId/);
  assert.throws(() => create({ active: false, horizontal: 1 }), /inactive/);
  assert.throws(() => create({ active: 'true', pointerId: 1 }), /boolean/);
});

test('vehicle_snapshot_is_a_detached_readonly_SI_value_with_four_wheel_slots', () => {
  const create = required(vehicle, 'createVehicleSnapshot');
  const state = vehicleState();
  const snapshot = create(state);
  state.position.x = 99;
  state.damage.parts.front = 0.8;
  assert.equal(snapshot.position.x, 1);
  assert.equal(snapshot.damage.parts.front, 0);
  assert(Object.isFrozen(snapshot.wheels));
  assert(Object.isFrozen(snapshot.damage.parts));
  assert.throws(() => { snapshot.position.x = 100; }, TypeError);
  for (const corrupt of [s => { s.position.x = NaN; }, s => { s.velocity.z = Infinity; },
    s => { s.rotation.w = 2; }, s => { s.wheels.pop(); }, s => { s.telemetry.speed = NaN; },
    s => { s.damage.self = s.damage; }]) {
    const bad = vehicleState(); corrupt(bad); assert.throws(() => create(bad));
  }
  const modelled = vehicleState();
  modelled.wheels = ['FL', 'FR', 'RL', 'RR'].map(id => ({ id, position: { x: 0, y: 0, z: 0 }, angularVelocity: -2, contact: true, normalForce: 100 }));
  assert.equal(create(modelled).wheels[0].normalForce, 100);
  modelled.wheels[0].contact = false;
  assert.throws(() => create(modelled), /normalForce|contact/);
});

test('session_contract_preserves_named_ports_and_has_no_render_loop', () => {
  const check = required(session, 'assertModeSession');
  const valid = Object.fromEntries(['start', 'pause', 'resume', 'step', 'snapshot', 'dispose'].map(k => [k, () => {}]));
  assert.equal(check(valid), valid);
  assert.throws(() => check({ ...valid, dispose: null }), /dispose/);
  const assertContext = required(session, 'assertModeContext');
  const context = {
    sessionId: 'driving-1', abortSignal: new AbortController().signal,
    clock: { advance() {}, pause() {}, resume() {}, reset() {}, snapshot() {} },
    input: { sample() {}, clear() {}, dispose() {} }, settings: { read() {}, write() {} },
    world() {}, renderer() {}, audio: {}, events: { emit() {}, subscribe() {}, dispose() {} }
  };
  assert.equal(assertContext(context), context);
  assert.throws(() => assertContext({ ...context, sessionId: '' }), /sessionId/);
  assert.throws(() => assertContext({ ...context, abortSignal: {} }), /abortSignal/);
  assert.throws(() => assertContext({ ...context, input: {} }), /sample/);
  assert.throws(() => assertContext({ ...context, sharedMutableState: {} }), /sharedMutableState|unknown/);
});

test('events_reject_invalid_session', () => {
  const channel = required(events, 'createEventChannel')('session-a');
  const create = required(events, 'createEvent');
  let delivered = 0;
  channel.subscribe(() => delivered++);
  const event = { eventId: 'goal-1', sessionId: 'session-b', type: 'GOAL', simTime: 1, payload: { score: 500 } };
  assert.throws(() => channel.emit(event), /session/);
  assert.equal(delivered, 0);
  for (const bad of [NaN, Infinity, -1]) assert.throws(() => create({ ...event, simTime: bad }), /simTime/);
  assert.throws(() => create({ ...event, eventId: '' }), /eventId/);
  assert.throws(() => create({ ...event, payload: { score: NaN } }), /finite/);
});

test('events_are_readonly_deduplicated_and_isolated_per_session', () => {
  const make = required(events, 'createEventChannel');
  const a = make('a'); const b = make('b');
  const observed = [];
  const unsubscribe = a.subscribe(e => observed.push(e));
  const event = { eventId: 'goal-1', sessionId: 'a', type: 'GOAL', simTime: 10, payload: { points: 500, detail: { kind: 'fixture' } } };
  assert.equal(a.emit(event), true);
  event.payload.points = 999;
  assert.equal(a.emit(event), false);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].payload.points, 500);
  assert(Object.isFrozen(observed[0].payload.detail));
  assert.equal(b.emit({ ...event, sessionId: 'b' }), true);
  unsubscribe(); unsubscribe();
  assert.equal(a.emit({ ...event, eventId: 'goal-2' }), true);
  assert.equal(observed.length, 1);
  a.dispose(); a.dispose();
  assert.throws(() => a.emit(event), /disposed/);
});
