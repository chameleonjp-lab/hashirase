import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionalModule } from '../support/foundation.mjs';
import { createFixedClock } from '../../src/platform/clock.js';
import { createEventChannel } from '../../src/contracts/events.js';
import { createInputFrame, assertVehicleSnapshot } from '../../src/contracts/vehicle.js';

const before = Object.getOwnPropertyDescriptors(globalThis);
const driving = await optionalModule('src/modes/driving/index.js');
const physics = await optionalModule('src/modes/driving/physics.js');
const audioModule = await optionalModule('src/platform/audio.js');
const after = Object.getOwnPropertyDescriptors(globalThis);
function api(module, name) { assert.equal(typeof module[name], 'function', `T03 requires ${name}`); return module[name]; }
let serial = 0;
function context() {
  const id = `driving-test-${++serial}`;
  const pending = [];
  const disposed = { world: 0, renderer: 0, input: 0, audio: 0 };
  const controller = new AbortController();
  return { controller, pending, disposed, services: {
    sessionId: id, abortSignal: controller.signal, clock: createFixedClock(),
    input: { sample: () => createInputFrame(), clear() {}, dispose() { disposed.input++; } },
    settings: { read: () => ({}), write() {} },
    world: { step() {}, query: () => ({ impacts: pending.splice(0), gripMultiplier: 1 }), reset() { pending.length = 0; }, dispose() { disposed.world++; } },
    renderer: { render() {}, resize() {}, dispose() { disposed.renderer++; } },
    audio: { pause() {}, resume() {}, dispose() { disposed.audio++; } },
    events: createEventChannel(id)
  } };
}

test('driving_import_has_no_side_effect', () => {
  api(driving, 'createMode');
  assert.deepEqual(after, before, 'Import must not allocate browser state, a loop, or a global registry');
});

test('two_driving_sessions_do_not_share_state', async () => {
  const create = api(driving, 'createMode');
  const a = context(); const b = context();
  const first = await create(a.services); const second = await create(b.services);
  first.start(); second.start();
  const original = second.snapshot();
  a.pending.push({ eventId: 'impact-1', category: 'POLICE_CAR', impactSpeed: 20 });
  first.step(1 / 120, createInputFrame({ throttle: 1 }));
  assert(first.snapshot().vehicle.damage.hp < 1000);
  assert.deepEqual(second.snapshot(), original);
  const detached = first.snapshot();
  assert.throws(() => { detached.vehicle.position.x = 200; }, TypeError);
  first.reset();
  assert.equal(first.snapshot().vehicle.damage.hp, 1000);
  assert.deepEqual(second.snapshot(), original);
  first.dispose(); second.dispose();
});

test('driving_start_pause_resume_reset_and_dispose_are_independent', async () => {
  const c = context(); const session = await api(driving, 'createMode')(c.services);
  const input = createInputFrame({ throttle: 1 });
  const initial = session.snapshot();
  assert.equal(initial.status, 'READY'); assertVehicleSnapshot(initial.vehicle);
  session.step(1 / 120, input); assert.deepEqual(session.snapshot(), initial);
  session.start(); session.start();
  for (let i = 0; i < 120; i++) session.step(1 / 120, input);
  assert(session.snapshot().vehicle.position.z < initial.vehicle.position.z);
  session.pause('test'); const paused = session.snapshot();
  session.step(1 / 120, input); assert.deepEqual(session.snapshot(), paused);
  session.resume(); session.step(1 / 120, input);
  assert.notDeepEqual(session.snapshot().vehicle.position, paused.vehicle.position);
  session.reset({ position: { x: 3, y: 0, z: 40 } });
  assert.deepEqual(session.snapshot().vehicle.position, { x: 3, y: 0, z: 40 });
  assert.deepEqual(session.snapshot().vehicle.velocity, { x: 0, y: 0, z: 0 });
  session.dispose();
  assert.equal(session.snapshot().status, 'DISPOSED');
  assert.throws(() => session.start(), /disposed/i);
});

test('driving_dispose_is_idempotent_and_abort_releases_owned_services', async () => {
  const c = context(); const session = await api(driving, 'createMode')(c.services);
  session.start(); c.controller.abort(); session.dispose(); session.dispose();
  assert.equal(session.snapshot().status, 'DISPOSED');
  assert.deepEqual(c.disposed, { world: 1, renderer: 1, input: 1, audio: 1 });
  const already = context(); already.controller.abort();
  await assert.rejects(() => driving.createMode(already.services), { name: 'AbortError' });
});

test('driving_rejects_invalid_inputs_and_collision_events_are_not_scored_twice', async () => {
  const c = context(); const session = await api(driving, 'createMode')(c.services);
  session.start();
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => session.step(dt, createInputFrame()), /dt/);
  assert.throws(() => session.step(1 / 120, { ...createInputFrame(), throttle: NaN }), /throttle/);
  const impact = { eventId: 'same-impact', category: 'CIVILIAN_CAR', impactSpeed: 20 };
  c.pending.push(impact); session.step(1 / 120, createInputFrame());
  const hp = session.snapshot().vehicle.damage.hp;
  c.pending.push(impact); session.step(1 / 120, createInputFrame());
  assert.equal(session.snapshot().vehicle.damage.hp, hp);
  assert.equal(session.snapshot().pursuit.carHits, 1);
  session.dispose();
});

test('driving_vehicle_model_is_numeric_and_keeps_hover_kickflip_and_coasting', () => {
  const create = api(physics, 'createVehicleModel');
  const model = create(); const neutral = createInputFrame();
  model.step(1 / 120, createInputFrame({ hover: true }), {});
  assert(model.snapshot().position.y > 0);
  assert.equal(model.snapshot().telemetry.mode, 'AIR');
  model.reset(); model.step(1 / 120, createInputFrame({ kickflip: true }), {});
  assert(model.snapshot().velocity.y > 0);
  model.reset();
  for (let i = 0; i < 60; i++) model.step(1 / 120, createInputFrame({ throttle: 1 }), {});
  const accelerated = model.snapshot();
  model.step(1 / 120, neutral, {});
  assert(model.snapshot().position.z < accelerated.position.z);
  assert(model.snapshot().velocity.z < 0);
  assertVehicleSnapshot(model.snapshot());
});

test('driving_brake_does_not_become_reverse_drive', () => {
  const model = api(physics, 'createVehicleModel')();
  for (let i = 0; i < 120; i++) model.step(1 / 120, createInputFrame({ brake: 1 }), {});
  assert.equal(model.snapshot().velocity.z, 0);
  for (let i = 0; i < 120; i++) model.step(1 / 120, createInputFrame({ reverseThrottle: 0.5 }), {});
  assert(model.snapshot().velocity.z > 0);
});

test('audio_import_and_silent_service_are_lazy_and_dispose_is_idempotent', async () => {
  let allocations = 0;
  const service = api(audioModule, 'createAudioService')({ createContext() { allocations++; throw new Error('no audio device'); } });
  assert.equal(allocations, 0);
  service.pause(); await service.dispose(); await service.dispose();
  assert.equal(allocations, 0);
});
