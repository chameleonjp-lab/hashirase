import {test,expect} from '@playwright/test';
import {buildProject} from '../../scripts/build.mjs';
test.beforeAll(async()=>{await buildProject({entryPoints:['src/modes/simulation/index.js']});});
test('simulation_minimum_track_uses_real_force_model_and_releases_its_canvas',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto('/tests/fixtures/simulation-track.html');await expect.poll(()=>page.evaluate(()=>window.harness?.available)).toBe(true);
 await expect(page.locator('canvas')).toHaveCount(1);await expect(page.getByText('推定デモ車・直線の最小モデル（実車未検証）')).toBeVisible();
 await page.locator('#accelerate').click();const moving=await page.evaluate(()=>window.harness.snapshot());
 expect(moving.vehicle.velocity.z).toBeLessThan(-2);expect(moving.vehicle.position.z).toBeLessThan(-1);
 await expect(page.locator('[data-speed]')).not.toHaveText('0.0 km/h');
 await testInfo.attach('simulation-track.png',{body:await page.screenshot(),contentType:'image/png'});
 await testInfo.attach('simulation-moving.json',{body:JSON.stringify(moving),contentType:'application/json'});
 await page.locator('#brake').click();const stopped=await page.evaluate(()=>window.harness.snapshot());expect(Math.abs(stopped.vehicle.velocity.z)).toBeLessThan(1e-12);
 await page.locator('#reset').click();await expect(page.locator('[data-speed]')).toHaveText('0.0 km/h');
 expect((await page.evaluate(()=>window.harness.snapshot())).vehicle.position).toEqual({x:0,y:0,z:0});
 expect(await page.evaluate(()=>window.harness.dispose())).toEqual({disposed:true,canvases:0});await expect(page.locator('canvas')).toHaveCount(0);expect(errors).toEqual([]);
});
