import { test, expect } from '@playwright/test';
import { prepareBaseline } from '../support/baseline-browser.mjs';
import { execFileSync } from 'node:child_process';

const baselineCommit='f44bb235a8c84f3a6af8b5c7338ebdb2f54bc442';
const oldBundle=execFileSync('git',['show',`${baselineCommit}:assets/js/simulator.js`],{cwd:new URL('../../',import.meta.url),maxBuffer:2*1024*1024,encoding:'utf8'});
const sourceProbe=`window.__legacyTrace={
 reset(initial){stopAutoDemo();resetVehicle(initial?.position?.x??0,initial?.position?.z??36);},
 kickflip(){document.getElementById('btn-kickflip').click();},
 advance(frames,frame){for(let i=0;i<frames;i++){Object.assign(inputs,frame);stepPhysics(1/120);}return {position:{x:carState.x,y:carState.y,z:carState.z},velocity:{x:carState.vx,y:carState.vy,z:carState.vz},rotation:{x:carRoot.quaternion.x,y:carRoot.quaternion.y,z:carRoot.quaternion.z,w:carRoot.quaternion.w},mode:carState.mode,gasMass:carState.airMassKg,hp:carState.hp};}
};`;

test('driving_lifecycle_preserves_controls_and_releases_resources', async ({ page }, testInfo) => {
  const diagnostics = await prepareBaseline(page, { observe: false });
  await page.goto('/tests/fixtures/driving-session.html');
  await expect.poll(() => page.evaluate(() => window.harness?.available)).toBe(true);
  const initial = await page.evaluate(() => window.harness.create());
  expect(initial.status).toBe('READY');
  await expect(page.locator('#loading-screen')).toHaveCount(0);
  await expect(page.locator('#canvas-container canvas')).toHaveCount(1);
  await page.evaluate(() => window.harness.start());
  const moving = await page.evaluate(() => window.harness.tick(120, { throttle: 1 }));
  expect(moving.vehicle.position.z).toBeLessThan(initial.vehicle.position.z);
  const paused = await page.evaluate(() => window.harness.pause());
  await page.keyboard.down('KeyW');
  expect(await page.evaluate(() => window.harness.tick(120))).toEqual(paused);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => window.harness.resume());
  await page.locator('#btn-toggle-course').click();
  expect((await page.evaluate(() => window.harness.tick())).course).toBe('NYC');
  await page.locator('#btn-reset-car').click();
  expect((await page.evaluate(() => window.harness.snapshot())).vehicle.damage.hp).toBe(1000);
  await testInfo.attach('driving-nyc.png', { body: await page.screenshot(), contentType: 'image/png' });
  await page.locator('#btn-toggle-course').click();
  await page.locator('#btn-kickflip').click();
  const air = await page.evaluate(() => window.harness.tick());
  expect(air.vehicle.telemetry.mode).toBe('AIR');
  expect(air.vehicle.velocity.y).toBeGreaterThan(0);
  await page.locator('#btn-sound').click();
  expect((await page.evaluate(()=>window.harness.audioDiagnostics())).contexts).toBe(1);
  await testInfo.attach('driving-kickflip.png', { body: await page.screenshot(), contentType: 'image/png' });
  const metrics = await page.evaluate(() => window.harness.dispose());
  expect(metrics.listeners).toBe(0); expect(metrics.timers).toBe(0);
  expect(metrics.liveResources).toBe(0); expect(metrics.disposedResources).toBeGreaterThan(0);
  expect((await page.evaluate(()=>window.harness.audioDiagnostics())).contexts).toBe(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(diagnostics.errors).toEqual([]);
  await testInfo.attach('driving-lifecycle.json', { body: JSON.stringify({ initial, moving, air, metrics, diagnostics }), contentType: 'application/json' });
});

test('driving_fixed_tick_trace_matches_pre_extraction_game', async ({ page, context },testInfo) => {
  test.setTimeout(90000);
  await prepareBaseline(page,{observe:false});
  await page.goto('/tests/fixtures/driving-session.html');
  await expect.poll(()=>page.evaluate(()=>window.harness?.available)).toBe(true);
  await page.evaluate(async()=>{await window.harness.create();window.harness.start();});
  const reference=await context.newPage();
  await prepareBaseline(reference,{sourceBundle:oldBundle,sourceProbe});
  await reference.goto('/legacy.html');
  await expect(reference.locator('#loading-screen')).toBeHidden();
  const neutral={accel:false,brake:false,left:false,right:false,boost:false,hover:false,rcsSpin:false};
  const observations=[];
  for(const run of [
    {name:'ramp-overhang-flight',frames:600,legacy:{...neutral,accel:true},frame:{throttle:1}},
    {name:'coasting-touchdown',frames:300,legacy:neutral,frame:{}},
    {name:'reset-kickflip',frames:90,legacy:neutral,frame:{},reset:true,kickflip:true},
    {name:'parked-truck-collision',frames:240,legacy:{...neutral,accel:true},frame:{throttle:1},reset:true,initial:{position:{x:-24,y:0,z:14}}}
  ]){
    if(run.reset){await reference.evaluate(initial=>window.__legacyTrace.reset(initial),run.initial);await page.evaluate(initial=>window.harness.reset(initial),run.initial);}
    if(run.kickflip){await reference.evaluate(()=>window.__legacyTrace.kickflip());await page.locator('#btn-kickflip').click();}
    const old=await reference.evaluate(({frames,legacy})=>window.__legacyTrace.advance(frames,legacy),run);
    const current=(await page.evaluate(({frames,frame})=>window.harness.tick(frames,frame),run)).vehicle;
    await testInfo.attach(run.name+'.json',{body:JSON.stringify({baseline:old,current}),contentType:'application/json'});
    if(run.name==='parked-truck-collision'){
      expect(old.hp).toBeLessThan(1000);expect(current.damage.hp).toBeLessThan(1000);
      expect(current.damage.hp).toBe(old.hp);
      for(const value of [...Object.values(current.position),...Object.values(current.velocity)])expect(Number.isFinite(value)).toBe(true);
    }
    for(const group of ['position','velocity','rotation'])for(const key of Object.keys(old[group]))expect(Math.abs(current[group][key]-old[group][key]),`${run.name} ${group}.${key}`).toBeLessThanOrEqual(1e-6);
    expect(current.telemetry.mode).toBe(old.mode);expect(Math.abs(current.telemetry.gasMass-old.gasMass)).toBeLessThanOrEqual(1e-6);
    observations.push({name:run.name,baseline:old,current});
  }
  await page.evaluate(()=>window.harness.dispose());await reference.close();
  await testInfo.attach('legacy-comparison.json',{body:JSON.stringify({baselineCommit,step:1/120,observations}),contentType:'application/json'});
});

test('driving_legacy_surface_honours_initial_course_trim_and_position',async({page})=>{
  await prepareBaseline(page,{observe:false});await page.goto('/tests/fixtures/driving-session.html');
  await expect.poll(()=>page.evaluate(()=>window.harness?.available)).toBe(true);
  const state=await page.evaluate(()=>window.harness.create({course:'NYC',trim:'PERF',initial:{position:{x:8,y:0,z:12}}}));
  expect(state.course).toBe('NYC');expect(state.trim).toBe('PERF');expect(state.vehicle.position).toEqual({x:8,y:0,z:12});
  await page.evaluate(()=>window.harness.dispose());
});

test('driving_paused_reset_immediately_synchronizes_pose_and_HUD_without_a_tick',async({page},testInfo)=>{
  await prepareBaseline(page,{observe:false});await page.goto('/tests/fixtures/driving-session.html');
  await expect.poll(()=>page.evaluate(()=>window.harness?.available)).toBe(true);
  await page.evaluate(async()=>{await window.harness.create({course:'NYC'});window.harness.start();window.harness.tick(120,{throttle:1});window.harness.pause();});
  expect(Number(await page.locator('#val-speed').textContent())).toBeGreaterThan(0);
  const reset=await page.evaluate(()=>window.harness.reset({position:{x:3,y:7,z:40}}));
  expect(reset.status).toBe('PAUSED');
  await expect(page.locator('#val-speed')).toHaveText('0');
  expect(reset.vehicle.position).toEqual({x:3,y:7,z:40});await expect(page.locator('#val-alt-ft')).toHaveText('23.0');
  expect(await page.evaluate(()=>window.harness.tick(1,{}))).toEqual(reset);
  await testInfo.attach('driving-paused-reset.png',{body:await page.screenshot(),contentType:'image/png'});
  await page.evaluate(()=>window.harness.dispose());
});

test('driving_police_and_siren_survive_audio_extraction',async({page})=>{
  const diagnostics=await prepareBaseline(page,{observe:false});await page.goto('/tests/fixtures/driving-session.html');
  await expect.poll(()=>page.evaluate(()=>window.harness?.available)).toBe(true);
  await page.evaluate(async()=>{await window.harness.create();window.harness.start();window.harness.reset({position:{x:-24,y:0,z:14}});
    window.harness.collision({eventId:'one',category:'CIVILIAN_CAR',impactSpeed:1});window.harness.collision({eventId:'two',category:'CIVILIAN_CAR',impactSpeed:1});});
  await page.locator('#btn-sound').click();
  const state=await page.evaluate(()=>window.harness.tick(200,{throttle:1}));
  expect(state.pursuit.active).toBe(true);expect(state.pursuit.carHits).toBeGreaterThanOrEqual(3);
  expect(diagnostics.errors).toEqual([]);await page.evaluate(()=>window.harness.dispose());
});

test('driving_external_input_blocks_legacy_keyboard_actions',async({page})=>{
  await prepareBaseline(page,{observe:false});await page.goto('/tests/fixtures/driving-session.html');
  await expect.poll(()=>page.evaluate(()=>window.harness?.available)).toBe(true);
  await page.evaluate(async()=>{await window.harness.create({legacyControls:false});window.harness.start();});
  await page.keyboard.press('KeyF');
  expect((await page.evaluate(()=>window.harness.snapshot())).vehicle.telemetry.mode).toBe('GROUND');
  const actual=await page.evaluate(()=>window.harness.tick(1,{kickflip:true}));
  expect(actual.vehicle.telemetry.mode).toBe('AIR');await page.evaluate(()=>window.harness.dispose());
});
