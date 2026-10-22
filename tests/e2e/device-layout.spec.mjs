import {test,expect} from '@playwright/test';
async function ready(page,profile='touch',mode='driving'){await page.goto(`/tests/fixtures/device-controls.html?profile=${profile}&mode=${mode}`);await expect.poll(()=>page.evaluate(()=>window.harness?.available)).toBe(true);}
const pointer=(id,x,y,type='touch')=>({pointerId:id,clientX:x,clientY:y,pointerType:type,button:0,bubbles:true});
const sample=(page,options)=>page.evaluate(options=>window.harness.sample(options),options);
for(const [width,height,profile]of [[360,640,'touch'],[393,852,'touch'],[430,932,'touch'],[640,360,'touch'],[852,393,'touch'],[932,430,'touch'],[1280,720,'hybrid'],[1920,1080,'desktop'],[800,720,'desktop']])test(`device_layout_${profile}_${width}x${height}`,async({page},info)=>{
 await page.setViewportSize({width,height});await ready(page,profile);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('[data-alternative]')).toHaveCount(0);
 for(const b of await page.locator('button:visible').all()){const box=await b.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
 const surface=page.locator('#surface'),box=await surface.boundingBox();expect(box.height).toBeGreaterThan(80);
 if(profile!=='desktop'){await surface.dispatchEvent('pointerdown',pointer(1,box.x+box.width/2,box.y+box.height/2));await surface.dispatchEvent('pointermove',pointer(1,box.x+box.width/2+40,box.y+box.height/2-40));expect((await sample(page)).throttle).toBeGreaterThan(0);expect((await sample(page)).steer).toBeGreaterThan(0);}
 await info.attach(`controls-${profile}-${width}x${height}.png`,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await page.evaluate(()=>window.harness.clear());
});
test('touch_ownership_second_finger_and_release_reach_InputFrame',async({page})=>{
 await ready(page);const surface=page.locator('#surface'),box=await surface.boundingBox(),x=box.x+120,y=box.y+160;
 await surface.dispatchEvent('pointerdown',pointer(1,x,y));expect((await sample(page)).throttle).toBe(0);
 await surface.dispatchEvent('pointermove',pointer(1,x+88,y-88));let f=await sample(page);expect(f.throttle).toBe(1);expect(f.steer).toBe(1);
 const boost=page.getByRole('button',{name:'ロケット',exact:true});await boost.dispatchEvent('pointerdown',pointer(2,x,y));expect((await sample(page)).boost).toBe(true);expect((await sample(page)).throttle).toBe(1);
 await surface.dispatchEvent('pointermove',pointer(2,x-88,y+88));expect((await sample(page)).steer).toBe(1);
 await boost.dispatchEvent('pointerup',pointer(2,x,y));expect((await sample(page)).boost).toBe(false);
 await surface.dispatchEvent('pointerup',pointer(1,x+88,y-88));f=await sample(page);expect(f.throttle).toBe(0);expect(f.steer).toBe(0);expect(f.brake).toBe(0);
 await surface.dispatchEvent('pointermove',pointer(2,x+88,y-88));expect((await sample(page)).throttle).toBe(0);
});
test('hybrid_keyboard_touch_mouse_repeat_and_focus_loss_are_independent',async({page})=>{
 await ready(page,'hybrid');const s=page.locator('#surface');await page.keyboard.down('KeyW');await s.dispatchEvent('pointerdown',pointer(1,180,260));await s.dispatchEvent('pointermove',pointer(1,240,200));expect((await sample(page)).throttle).toBe(1);await s.dispatchEvent('pointerup',pointer(1,240,200));expect((await sample(page)).throttle).toBe(1);
 await page.keyboard.down('KeyC');await page.keyboard.down('KeyC');expect((await page.evaluate(()=>window.harness.metrics())).camera).toBe(1);await page.keyboard.up('KeyC');
 await s.dispatchEvent('pointerdown',pointer(8,200,250,'mouse'));await s.dispatchEvent('pointermove',pointer(8,220,260,'mouse'));await s.dispatchEvent('pointerup',pointer(8,220,260,'mouse'));expect((await page.evaluate(()=>window.harness.metrics())).look).toBeGreaterThan(0);
 await page.evaluate(()=>dispatchEvent(new Event('blur')));expect((await sample(page)).throttle).toBe(0);await page.keyboard.up('KeyW');
});
test('settings_exclude_driving_swipe_and_mode_inappropriate_fields_and_restore_focus',async({page})=>{
 await ready(page,'desktop','simulation');await page.locator('#settings-open').click();await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByLabel('左右のスワイプ感度')).toHaveCount(0);await expect(page.getByLabel('キー割当: ロケット')).toHaveCount(0);await expect(page.getByLabel('キー割当: 前進')).toBeVisible();
 await page.getByRole('button',{name:'閉じる',exact:true}).click();await expect(page.locator('#settings-open')).toBeFocused();
 await ready(page,'touch');await page.locator('#settings-open').click();await expect(page.getByLabel('マウス感度')).toHaveCount(0);await expect(page.getByLabel('左右のスワイプ感度')).toBeVisible();
 await page.getByLabel('音量').fill('0.8');await page.getByRole('button',{name:'適用',exact:true}).click();await page.reload();await expect.poll(()=>page.evaluate(()=>window.harness?.available)).toBe(true);expect((await page.evaluate(()=>window.harness.settings())).volume).toBe(0.8);
});
test('settings_modal_rotation_hidden_lost_capture_and_alternatives_clear_input',async({page})=>{
 await ready(page);const s=page.locator('#surface');const start=async()=>{await s.dispatchEvent('pointerdown',pointer(1,180,280));await s.dispatchEvent('pointermove',pointer(1,200,190));expect((await sample(page)).throttle).toBe(1);};
 for(const event of ['pointercancel','lostpointercapture']){await start();await s.dispatchEvent(event,pointer(1,200,190));expect((await sample(page)).throttle).toBe(0);}
 await start();await page.evaluate(()=>dispatchEvent(new Event('orientationchange')));expect((await sample(page)).throttle).toBe(0);
 await start();await page.locator('#settings-open').click();expect((await sample(page)).throttle).toBe(0);await s.dispatchEvent('pointerdown',pointer(4,180,280));await s.dispatchEvent('pointermove',pointer(4,200,190));expect((await sample(page)).throttle).toBe(0);
 await page.getByLabel('代替の明示操作を表示').check();await page.getByRole('button',{name:'適用',exact:true}).click();await expect(page.locator('[data-alternative]')).toHaveCount(4);
 await page.getByRole('button',{name:'前進',exact:true}).dispatchEvent('pointerdown',pointer(3,200,400));expect((await sample(page)).throttle).toBe(1);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});expect((await sample(page)).throttle).toBe(0);
});
test('settings_at_200_percent_and_manual_profile_switch_remain_usable',async({page},info)=>{
 await page.setViewportSize({width:393,height:852});await ready(page);await page.addStyleTag({content:'html{font-size:200%}'});await page.locator('#settings-open').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'閉じる',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'閉じる',exact:true})).toBeVisible();await info.attach('settings-touch-200-percent.png',{body:await page.screenshot(),contentType:'image/png'});
 await page.getByLabel('操作する端末').selectOption('hybrid');expect(await page.evaluate(()=>window.harness.profile())).toBe('hybrid');await page.locator('#settings-open').click();await expect(page.getByLabel('左右のスワイプ感度')).toBeVisible();await expect(page.getByLabel('マウス感度')).toBeVisible();
});
