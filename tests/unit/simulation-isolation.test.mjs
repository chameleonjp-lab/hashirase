import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { optionalModule } from '../support/foundation.mjs';
import { createInputFrame } from '../../src/contracts/vehicle.js';
import { createFixedClock } from '../../src/platform/clock.js';
import { createEventChannel } from '../../src/contracts/events.js';

const simulation=await optionalModule('src/modes/simulation/index.js');
const physics=await optionalModule('src/modes/simulation/physics/vehicle-model.js');
function factory(){assert.equal(typeof simulation.createMode,'function','T04 requires its own createMode');return simulation.createMode;}
let serial=0;
function context(){const controller=new AbortController(),id=`sim-${++serial}`,disposed=[];return{controller,disposed,services:{
  sessionId:id,abortSignal:controller.signal,clock:createFixedClock(),events:createEventChannel(id),
  input:{sample:()=>createInputFrame(),clear(){},dispose(){disposed.push('input');}},settings:{read:()=>({}),write(){}},
  world:{step(){},query:()=>({}),reset(){},dispose(){disposed.push('world');}},renderer:{render(){},resize(){},dispose(){disposed.push('renderer');}},audio:{dispose(){disposed.push('audio');}}
}};}

test('simulation_has_no_game_rules',()=>{
  assert.equal(typeof physics.createVehicleModel,'function','T04 requires numeric physics');
  const plain=physics.createVehicleModel(),special=physics.createVehicleModel();
  for(let i=0;i<120;i++){
    plain.step(1/120,createInputFrame({throttle:1}),{});
    special.step(1/120,createInputFrame({throttle:1,steer:1,boost:true,hover:true,kickflip:true}),{});
  }
  assert.deepEqual(special.snapshot(),plain.snapshot());
  assert.deepEqual(special.snapshot().damage,{});
  for(const forbidden of ['hp','score','police','rocket','gasMass'])assert(!Object.hasOwn(special.snapshot().telemetry,forbidden));
});

test('simulation_sessions_start_pause_reset_and_remain_independent',async()=>{
  const a=context(),b=context(),create=factory();const first=await create(a.services),second=await create(b.services);
  assert.equal(first.snapshot().status,'READY');first.start();second.start();const original=second.snapshot();
  first.step(1/120,createInputFrame({throttle:1}));assert(first.snapshot().vehicle.velocity.z<0);assert.deepEqual(second.snapshot(),original);
  first.pause('test');const paused=first.snapshot();first.step(1/120,createInputFrame({throttle:1}));assert.deepEqual(first.snapshot(),paused);
  first.resume();first.step(1/120,createInputFrame({throttle:1}));first.reset();assert.equal(first.snapshot().vehicle.position.z,0);
  assert.deepEqual(second.snapshot(),original);first.dispose();first.dispose();second.dispose();assert.deepEqual(a.disposed.sort(),['audio','input','renderer','world']);
});

test('simulation_abort_disposes_without_global_or_timing_state',async()=>{
  const c=context(),session=await factory()(c.services);c.controller.abort();
  assert.equal(session.snapshot().status,'DISPOSED');session.dispose();assert.equal(c.disposed.length,4);
  const ready=context();ready.controller.abort();await assert.rejects(()=>simulation.createMode(ready.services),{name:'AbortError'});
});

test('simulation_build_and_import_graph_contain_no_driving_code_or_engine',async()=>{
  factory();const {checkBoundaries}=await import('../../scripts/check-boundaries.mjs');
  const graph=await checkBoundaries();assert.deepEqual(graph.violations,[]);
  const {buildProject}=await import('../../scripts/build.mjs');
  const {manifest}=await buildProject({entryPoints:['src/modes/simulation/index.js']});
  assert(!manifest.inputFiles.some(f=>/modes\/driving|runtime|legacy|node_modules\/three/.test(f.path)));
  const sources=await Promise.all(manifest.inputFiles.filter(f=>f.path.endsWith('.js')).map(f=>readFile(new URL('../../'+f.path,import.meta.url),'utf8')));
  assert(!sources.some(s=>/Math\.random|requestAnimationFrame|setInterval|performance\.now/.test(s)));
});

test('simulation_cancellation_releases_supplied_services_immediately_and_late_world_once',async()=>{
 const c=context();let resolveWorld,worldDisposals=0;const pending=new Promise(resolve=>{resolveWorld=resolve;});
 c.services.world=()=>pending;const creating=factory()(c.services);c.controller.abort();
 assert.deepEqual(c.disposed.sort(),['audio','input','renderer']);
 resolveWorld({step(){},query:()=>({}),reset(){},dispose(){worldDisposals++;}});
 await assert.rejects(creating,{name:'AbortError'});assert.equal(worldDisposals,1);assert.equal(c.disposed.length,3);
});

test('simulation_startup_errors_and_invalid_reset_cannot_leak_owned_services',async()=>{
 for(const failure of ['world','config']){
  const c=context();if(failure==='world')c.services.world=async()=>{throw Error('world failed');};
  await assert.rejects(()=>factory()(c.services,failure==='config'?{config:{}}:{}));
  assert.deepEqual(c.disposed.sort(),failure==='world'?['audio','input','renderer']:['audio','input','renderer','world']);
 }
 const c=context(),session=await factory()(c.services);const before=session.snapshot();
 assert.throws(()=>session.reset({velocity:{x:1.1e308,y:1.1e308,z:1.1e308}}),/finite|speed/);assert.deepEqual(session.snapshot(),before);
 assert.doesNotThrow(()=>session.dispose());assert.deepEqual(c.disposed.sort(),['audio','input','renderer','world']);
});
