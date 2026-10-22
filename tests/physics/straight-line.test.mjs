import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionalModule } from '../support/foundation.mjs';
import { createInputFrame, assertVehicleSnapshot } from '../../src/contracts/vehicle.js';
import { createFixedClock } from '../../src/platform/clock.js';

const physics=await optionalModule('src/modes/simulation/physics/vehicle-model.js');
const configModule=await optionalModule('src/modes/simulation/config/demo-car.js');
function api(){assert.equal(typeof physics.createVehicleModel,'function','T04 requires an independent createVehicleModel');return physics.createVehicleModel;}
function config(values={}){
  assert(configModule.DEMO_CAR,'T04 requires versioned parameter metadata');
  const c=structuredClone(configModule.DEMO_CAR);
  for(const [key,value]of Object.entries(values))c.parameters[key]={...c.parameters[key],value,origin:'reference',source:'analytic test fixture'};
  return c;
}
const neutral=createInputFrame();

test('force_over_mass_accelerates',()=>{
  const model=api()(config({mass:1000,dragCoefficient:0,rollingCoefficient:0}));
  for(let i=0;i<1200;i++)model.step(1/120,neutral,{externalForce:{x:1000,y:0,z:0}});
  const state=model.snapshot();assertVehicleSnapshot(state);
  assert(Math.abs(state.velocity.x-10)<=0.01);assert(Math.abs(state.position.x-50)<=0.10);
  assert(Math.abs(state.telemetry.acceleration.x-1)<1e-12);
  assert.equal(state.telemetry.forces.total.x,1000);assert.equal(state.telemetry.mass,1000);
});

test('drive_force_is_scaled_by_throttle_and_reverse_has_the_opposite_sign',()=>{
  const create=api(),c=config({mass:1000,maxDriveForce:2000,dragCoefficient:0,rollingCoefficient:0});
  const forward=create(c),reverse=create(c);
  for(let i=0;i<120;i++){forward.step(1/120,createInputFrame({throttle:0.5}),{});reverse.step(1/120,createInputFrame({reverseThrottle:0.5}),{});}
  assert(Math.abs(forward.snapshot().velocity.z+1)<1e-12);
  assert(Math.abs(reverse.snapshot().velocity.z-1)<1e-12);
  assert(Math.abs(forward.snapshot().position.z+reverse.snapshot().position.z)<1e-12);
});

test('drag_does_not_accelerate_rest',()=>{
  const model=api()();const start=model.snapshot();
  for(let i=0;i<1200;i++)model.step(1/120,neutral,{});
  assert.deepEqual(model.snapshot().position,start.position);
  assert.deepEqual(model.snapshot().velocity,start.velocity);
  assert.deepEqual(model.snapshot().telemetry.forces.drag,{x:0,y:0,z:0});
  assert.deepEqual(model.snapshot().telemetry.forces.rolling,{x:0,y:0,z:0});
});

test('resistance_opposes_motion_and_never_reverses_it',()=>{
  for(const direction of [-1,1]){
    const model=api()();model.reset({velocity:{x:0,y:0,z:direction*0.05}});
    for(let i=0;i<240;i++){model.step(1/120,neutral,{});assert(model.snapshot().velocity.z*direction>=0);}
    assert(Math.abs(model.snapshot().velocity.z)<1e-12);
  }
});

test('braking_stops_forward_and_reverse_without_driving_through_zero',()=>{
  for(const direction of [-1,1]){
    const model=api()();model.reset({velocity:{x:0,y:0,z:direction*10}});
    for(let i=0;i<600;i++){model.step(1/120,createInputFrame({brake:1}),{});assert(model.snapshot().velocity.z*direction>=0);}
    assert(Math.abs(model.snapshot().velocity.z)<1e-12);
  }
});

test('zero_input_remains_finite_and_three_translation_axes_obey_F_equals_ma',()=>{
  const model=api()(config({mass:1000,dragCoefficient:0,rollingCoefficient:0}));
  for(let i=0;i<120;i++)model.step(1/120,neutral,{externalForce:{x:1000,y:2000,z:-3000}});
  const state=model.snapshot();assertVehicleSnapshot(state);
  for(const [axis,expected]of Object.entries({x:1,y:2,z:-3}))assert(Math.abs(state.velocity[axis]-expected)<1e-12);
  assert.equal(state.telemetry.rotationModel,'not-modelled');
  assert.deepEqual(state.wheels,[null,null,null,null]);
});

test('same_tick_inputs_are_reproducible_across_render_schedules_and_five_runs',()=>{
  const create=api();const run=fps=>{
    const model=create(),clock=createFixedClock();
    for(let frame=0;frame<10*fps;frame++)clock.advance(1/fps,(dt,tick)=>model.step(dt,createInputFrame({throttle:tick<600?0.7:0,brake:tick>=900?0.5:0}),{}));
    assert.equal(clock.snapshot().ticks,1200);return model.snapshot();
  };
  const expected=run(30);for(const fps of [30,60,120,30,60])assert.deepEqual(run(fps),expected);
});

test('invalid_config_input_environment_and_overflow_do_not_corrupt_state',()=>{
  const create=api();
  for(const bad of [0,-1,NaN,Infinity])assert.throws(()=>create(config({mass:bad})),/mass/);
  const invalid=config();invalid.parameters.mass.origin='unverified-official';assert.throws(()=>create(invalid),/origin/);
  const model=create(),before=model.snapshot();
  for(const dt of [0,-1,NaN,Infinity])assert.throws(()=>model.step(dt,neutral,{}),/dt/);
  assert.throws(()=>model.step(1/120,{...neutral,throttle:NaN},{}),/throttle/);
  assert.throws(()=>model.step(1/120,neutral,{externalForce:{x:NaN,y:0,z:0}}),/externalForce/);
  assert.throws(()=>model.step(Number.MAX_VALUE,createInputFrame({throttle:1}),{}),/finite|position|velocity|time/);
  assert.deepEqual(model.snapshot(),before);
});

test('parameter_metadata_is_bounded_versioned_and_detached',()=>{
  const c=config(),model=api()(c),before=model.snapshot();
  for(const [name,p]of Object.entries(c.parameters)){
    assert(['estimated','reference','measured'].includes(p.origin),name);assert(p.unit&&p.source&&p.version,name);
    assert(Number.isFinite(p.min)&&Number.isFinite(p.max)&&p.min<=p.value&&p.value<=p.max,name);
  }
  c.parameters.mass.value=99999;assert.deepEqual(model.snapshot(),before);
  assert.equal(before.telemetry.parameters.mass.origin,'estimated');
});
