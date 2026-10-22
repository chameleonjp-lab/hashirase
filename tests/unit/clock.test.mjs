import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionalModule, required } from '../support/foundation.mjs';

const clocks = await optionalModule('src/platform/clock.js');
const random = await optionalModule('src/platform/random.js');

test('clock_is_render_rate_independent', () => {
  const create = required(clocks, 'createFixedClock');
  const snapshots = [30, 60, 120].map(fps => {
    const clock = create({ step: 1 / 120, maxSteps: 8 });
    let velocity = 0; let position = 0;
    for (let frame = 0; frame < 10 * fps; frame++) {
      clock.advance(1 / fps, (dt, tick) => {
        const acceleration = tick < 600 ? 1 : -0.25;
        position += velocity * dt + acceleration * dt * dt / 2;
        velocity += acceleration * dt;
      });
    }
    const state = clock.snapshot();
    assert.equal(state.ticks, 1200); assert.equal(state.simTime, 10); assert.equal(state.valid, true);
    assert(state.backlog < 1e-9);
    return [velocity, position];
  });
  for (const state of snapshots) for (let i = 0; i < state.length; i++) assert(Math.abs(state[i] - snapshots[0][i]) <= 1e-6);
});

test('clock_marks_overload_without_dropping_unprocessed_time', () => {
  const clock = required(clocks, 'createFixedClock')({ step: 1 / 120, maxSteps: 8 });
  let steps = 0;
  const state = clock.advance(0.25, () => steps++);
  assert.equal(steps, 8); assert.equal(state.paused, true); assert.equal(state.valid, false);
  assert.equal(state.pauseReason, 'overload');
  assert(Math.abs(state.activeTime - 0.25) < 1e-12);
  assert(Math.abs(state.backlog - (0.25 - 8 / 120)) < 1e-12);
  clock.advance(30, () => steps++);
  assert.equal(steps, 8); assert.equal(clock.snapshot().activeTime, 0.25);
  assert.throws(() => clock.resume(), /reset/);
  clock.reset(); assert.equal(clock.snapshot().valid, true); assert.equal(clock.snapshot().backlog, 0);
});

test('clock_bounds_each_advance_and_can_drain_a_short_backlog', () => {
  const clock = required(clocks, 'createFixedClock')();
  let steps = 0;
  clock.advance(0.1, () => steps++);
  assert.equal(steps, 8); assert.equal(clock.snapshot().valid, true);
  clock.advance(0, () => steps++);
  assert.equal(steps, 12); assert(clock.snapshot().backlog < 1e-9);
});

test('clock_pause_excludes_hidden_time_and_resume_does_not_catch_up', () => {
  const clock = required(clocks, 'createFixedClock')();
  let steps = 0;
  clock.advance(1 / 120, () => steps++); clock.pause('hidden');
  const paused = clock.snapshot(); clock.advance(3600, () => steps++);
  assert.deepEqual(clock.snapshot(), paused);
  clock.resume(); clock.advance(1 / 120, () => steps++);
  assert.equal(steps, 2); assert.equal(clock.snapshot().activeTime, 2 / 120);
});

test('clock_rejects_bad_values_and_does_not_replay_a_failed_step', () => {
  const create = required(clocks, 'createFixedClock');
  for (const bad of [0, -1, NaN, Infinity, '0.01']) assert.throws(() => create({ step: bad }), /step/);
  for (const bad of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => create({ maxSteps: bad }), /maxSteps/);
  const clock = create();
  for (const bad of [-1, NaN, Infinity, '1']) assert.throws(() => clock.advance(bad, () => {}), /elapsed/);
  assert.equal(clock.snapshot().activeTime, 0);
  assert.throws(() => clock.advance(1 / 60, () => { throw new Error('failed step'); }), /failed step/);
  assert.equal(clock.snapshot().paused, true); assert.equal(clock.snapshot().valid, false);
  assert.equal(clock.snapshot().pauseReason, 'step-error');
  assert.throws(() => clock.resume(), /reset/);
});

test('random_is_repeatable_and_visual_draws_do_not_change_physics', () => {
  const create = required(random, 'createRandom');
  const samples = () => { const rng = create(12345); return Array.from({ length: 100 }, () => rng.next()); };
  const expected = samples();
  for (let n = 0; n < 5; n++) assert.deepEqual(samples(), expected);
  assert(expected.every(n => n >= 0 && n < 1));
  const root = create(42); const physics = root.fork('physics'); const visual = root.fork('visual');
  const reference = create(42).fork('physics');
  for (let i = 0; i < 100; i++) {
    for (let j = 0; j < i; j++) visual.next();
    root.next(); assert.equal(physics.next(), reference.next());
  }
  assert.notDeepEqual(create(42).fork('physics').snapshot(), create(42).fork('visual').snapshot());
  const rng = create(12345); rng.next(); rng.reset(); assert.equal(rng.next(), expected[0]);
  for (const bad of [-1, 2 ** 32, NaN, Infinity, 'seed', null]) assert.throws(() => create(bad), /seed/);
});
