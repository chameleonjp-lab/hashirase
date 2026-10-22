import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { parse } from 'acorn';
import * as THREE from 'three';
import { optionalModule } from '../support/foundation.mjs';
import { createFixedClock } from '../../src/platform/clock.js';
import { createEventChannel } from '../../src/contracts/events.js';
import { createRandom } from '../../src/platform/random.js';
import { createInputFrame, assertVehicleSnapshot } from '../../src/contracts/vehicle.js';

const before = Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(globalThis)));
const driving = await optionalModule('src/modes/driving/index.js');
const physics = await optionalModule('src/modes/driving/physics.js');
const audioModule = await optionalModule('src/platform/audio.js');
const after = Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(globalThis)));
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
  // A fresh process traps browser/timer access. Node's own lazy Undici dispatcher
  // may add a non-enumerable Symbol during module loading in this managed host.
  const script = `for(const key of ['window','document','navigator'])Object.defineProperty(globalThis,key,{get(){throw new Error('import touched '+key)}});for(const key of ['requestAnimationFrame','setInterval','setTimeout'])globalThis[key]=()=>{throw new Error('import started '+key)};await import(${JSON.stringify(new URL('../../src/modes/driving/index.js', import.meta.url).href)});`;
  execFileSync(process.execPath,['--input-type=module','-e',script]);
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

test('numeric_driving_session_uses_the_city_origin_when_NYC_is_selected',async()=>{
  const c=context();const session=await api(driving,'createMode')(c.services,{course:'NYC'});
  assert.deepEqual(session.snapshot().vehicle.position,{x:0,y:0,z:0});session.reset();
  assert.deepEqual(session.snapshot().vehicle.position,{x:0,y:0,z:0});session.dispose();
});

test('driving_dispose_is_idempotent_and_abort_releases_owned_services', async () => {
  const c = context(); const session = await api(driving, 'createMode')(c.services);
  session.start(); c.controller.abort(); session.dispose(); session.dispose();
  assert.equal(session.snapshot().status, 'DISPOSED');
  assert.deepEqual(c.disposed, { world: 1, renderer: 1, input: 1, audio: 1 });
  const already = context(); already.controller.abort();
  await assert.rejects(() => driving.createMode(already.services), { name: 'AbortError' });
});

test('driving_disposal_continues_when_one_owned_service_fails', async () => {
  const c=context();
  c.services.audio.dispose=()=>{c.disposed.audio++;throw new Error('audio close failed');};
  const session=await api(driving,'createMode')(c.services);session.start();
  assert.doesNotThrow(()=>session.dispose());
  assert.deepEqual(c.disposed,{world:1,renderer:1,input:1,audio:1});
  assert.equal(session.snapshot().status,'DISPOSED');
  assert(session.snapshot().cleanupErrors.some(error=>error.includes('audio close failed')));
  session.dispose();assert.equal(c.disposed.audio,1);
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

test('explicit_braking_opposes_reverse_motion_and_air_motion_without_propulsion',()=>{
  const create=api(physics,'createVehicleModel');
  const braking=create({course:'NYC'}),coasting=create({course:'NYC'});
  for(let i=0;i<120;i++)for(const model of [braking,coasting])model.step(1/120,createInputFrame({reverseThrottle:1}),{});
  const before=braking.snapshot().velocity.z;assert(before>10);
  for(let i=0;i<120;i++){
    braking.step(1/120,createInputFrame({brake:1}),{});
    coasting.step(1/120,createInputFrame(),{});
    assert(braking.snapshot().velocity.z>=0,'Brake must not propel through rest');
  }
  assert(braking.snapshot().velocity.z<coasting.snapshot().velocity.z);
  const hovering=create({course:'NYC'});
  for(let i=0;i<121;i++)hovering.step(1/120,createInputFrame({hover:true,brake:1}),{});
  assert.equal(hovering.snapshot().velocity.z,0,'Air brake must not provide reverse thrust at rest');
  hovering.reset();
  for(let i=0;i<120;i++)hovering.step(1/120,createInputFrame({hover:true,reverseThrottle:1}),{});
  const reverseSpeed=hovering.snapshot().velocity.z;assert(reverseSpeed>10,'Explicit reverse works in air');
  for(let i=0;i<120;i++)hovering.step(1/120,createInputFrame({hover:true,brake:1}),{});
  assert(hovering.snapshot().velocity.z>=0);assert(hovering.snapshot().velocity.z<reverseSpeed*0.1);
});

test('audio_import_and_silent_service_are_lazy_and_dispose_is_idempotent', async () => {
  let allocations = 0;
  const service = api(audioModule, 'createAudioService')({ createContext() { allocations++; throw new Error('no audio device'); } });
  assert.equal(allocations, 0);
  service.pause(); await service.dispose(); await service.dispose();
  assert.equal(allocations, 0);
});

test('driving_build_has_a_real_mode_entry_without_simulation_or_Three', async () => {
  const { buildProject } = await import('../../scripts/build.mjs');
  const { manifest } = await buildProject({entryPoints:['src/modes/driving/index.js']});
  assert(manifest.entryPoints['src/modes/driving/index.js'], 'T03 mode must be available from the build');
  assert(manifest.inputFiles.some(f => f.path === 'src/modes/driving/physics.js'));
  assert(!manifest.inputFiles.some(f => /modes\/simulation|node_modules\/three/.test(f.path)));
  const built=await import(new URL('../../'+manifest.entryPoints['src/modes/driving/index.js'],import.meta.url));
  assert.equal(typeof built.loadScreenAssets,'function','Selected game must provide its own screen/style assets');
  const assets=await built.loadScreenAssets();
  assert((await readFile(new URL(assets.screenURL),'utf8')).includes('id="btn-kickflip"'));
  assert.equal(await readFile(new URL(assets.styleURL),'utf8'),await readFile(new URL('../../assets/css/simulator.css',import.meta.url),'utf8'));
});

async function legacyFunction(name) {
  const source=await readFile(new URL('../../src/modes/driving/legacy-adapter.js',import.meta.url),'utf8');
  let found;
  function visit(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id.name===name)found=source.slice(node.start,node.end);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
  visit(parse(source,{ecmaVersion:'latest',sourceType:'module'}));assert(found,`Real adapter function ${name}`);return found;
}

test('legacy_smoke_rendering_does_not_consume_the_physics_random_stream',async()=>{
  const physicsRandom=createRandom(42).fork('physics'),visualRandom=createRandom(42).fork('visual');
  const before=physicsRandom.snapshot(),mesh=new THREE.Mesh();
  const particle={mesh};
  new Script((await legacyFunction('spawnSmokePuff'))+';spawnSmokePuff(0,0.5,0);').runInNewContext({physicsRandom,visualRandom,smokeParticles:[particle],smokeIdx:0});
  assert(particle.life>0);assert(mesh.visible);assert.deepEqual(physicsRandom.snapshot(),before);
  assert(visualRandom.snapshot().draws>0);mesh.geometry.dispose();mesh.material.dispose();
});

test('legacy_animation_uses_simulation_time_instead_of_sampling_wall_time',async()=>{
  const group=new THREE.Group();
  new Script((await legacyFunction('updatePoliceHelicopter'))+';updatePoliceHelicopter(1/120);').runInNewContext({
    performance:{now(){throw new Error('Unexpected wall-clock read');}},simulationTime:1,
    policePursuitState:{active:true,gameOver:false},policeHeliGroup:group,
    carState:{x:0,z:0,vx:0,vz:0},heliMainRotor:null,heliTailRotor:null
  });
  assert(Math.abs(group.position.y-(42+Math.sin(2.2)*1.2))<1e-12);
});
