import {test,expect} from '@playwright/test';import {readFile} from 'node:fs/promises';
import {prepareApp as prepare,tick,diagnostics} from '../support/app-browser.mjs';
async function select(page,mode){await page.locator(`[data-select-mode="${mode}"]`).click();await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state','RUNNING');await expect(page.locator('canvas')).toHaveCount(1);await tick(page);}
async function home(page){await page.getByRole('button',{name:'ホームへ',exact:true}).click();await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state','HOME');await expect(page.locator('canvas')).toHaveCount(0);}
test('home_requests_no_3d',async({page},info)=>{
 const d=await prepare(page);const m=JSON.parse(await readFile(new URL('../../dist/build-manifest.json',import.meta.url),'utf8'));const forbidden=m.outputs.filter(out=>out.inputs.some(input=>/src\/(?:modes|assets)\/(?:driving|simulation)\/|node_modules\/three|src\/rendering\/|src\/platform\/audio/.test(input))).map(out=>'/'+out.path);await page.goto('/');await expect(page.getByRole('button',{name:'ゲームをはじめる',exact:true})).toBeVisible();expect(d.requests.filter(url=>forbidden.includes(new URL(url).pathname))).toEqual([]);
 expect(d.requests.filter(url=>/three|assets\/js\/simulator|modes\/(driving|simulation)|legacy-adapter/.test(url))).toEqual([]);
 await expect(page.getByRole('button',{name:'シミュレーターをはじめる',exact:true})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);expect((await diagnostics(page)).initialized).toEqual({driving:0,simulation:0});
 await info.attach('home.png',{body:await page.screenshot(),contentType:'image/png'});await info.attach('home-network.json',{body:JSON.stringify({requests:d.requests,forbidden,diagnostics:await diagnostics(page)}),contentType:'application/json'});expect(d.errors).toEqual([]);
});
for(const mode of ['driving','simulation'])test(`${mode}_does_not_fetch_${mode==='driving'?'simulation':'driving'}`,async({page},info)=>{
 const d=await prepare(page);const manifest=JSON.parse(await readFile(new URL('../../dist/build-manifest.json',import.meta.url),'utf8'));const opposite=mode==='driving'?'simulation':'driving';
 const forbidden=manifest.outputs.filter(output=>output.inputs.some(input=>input.includes(`/modes/${opposite}/`)||input.includes(`/assets/${opposite}/`)||(mode==='simulation'&&(/node_modules\/three|src\/rendering\/|src\/platform\/audio/.test(input))))).map(output=>'/'+output.path);
 await page.goto('/');await select(page,mode);expect(d.requests.filter(url=>forbidden.some(path=>new URL(url).pathname===path))).toEqual([]);
 const state=await diagnostics(page);expect(state.initialized[opposite]).toBe(0);expect(state.activeSession).toBe(1);expect(state.activeRAF).toBeLessThanOrEqual(1);
 await info.attach(mode+'.png',{body:await page.screenshot(),contentType:'image/png'});await home(page);expect((await diagnostics(page)).activeSession).toBe(0);expect((await diagnostics(page)).activeRAF).toBe(0);expect(d.errors).toEqual([]);
 await info.attach(mode+'-network.json',{body:JSON.stringify({requests:d.requests,forbidden,diagnostics:await diagnostics(page)}),contentType:'application/json'});
});
test('mode_round_trips_and_inputs_remain_owned',async({page})=>{
 const d=await prepare(page);await page.goto('/');for(let i=0;i<20;i++)for(const mode of ['driving','simulation']){await select(page,mode);await page.keyboard.down('KeyW');await tick(page,2);await page.keyboard.up('KeyW');await page.getByRole('button',{name:'一時停止',exact:true}).click();await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state','PAUSED');await page.getByRole('button',{name:'再開',exact:true}).click();await home(page);}
 expect(d.errors).toEqual([]);expect((await diagnostics(page)).maxActiveSession).toBe(1);expect((await diagnostics(page)).maxCanvas).toBe(1);expect((await diagnostics(page)).cleanupErrors).toEqual([]);await expect(page.locator('.dialogs dialog')).toHaveCount(0);await expect(page.locator('link[href*="/assets/screen-"]')).toHaveCount(0);
});

test('real_settings_persist_per_mode_and_do_not_resume_held_input',async({page},info)=>{
 await prepare(page);await page.goto('/');await select(page,'simulation');await page.keyboard.down('KeyW');await tick(page,2);expect((await diagnostics(page)).input.throttle).toBe(1);
 await page.getByRole('button',{name:'設定',exact:true}).click();const dialog=page.getByRole('dialog',{name:'操作と表示の設定'});await expect(dialog).toBeVisible();expect((await diagnostics(page)).input.throttle).toBe(0);
 await expect(dialog.getByLabel('音量',{exact:true})).toHaveCount(0);await expect(dialog.getByLabel('視点',{exact:true})).toHaveCount(0);await expect(dialog.getByLabel('キー割当: ロケット')).toHaveCount(0);
 await dialog.getByLabel('速度の単位').selectOption('mph');await dialog.getByRole('button',{name:'適用',exact:true}).click();await expect(dialog).not.toBeVisible();await page.keyboard.up('KeyW');await page.getByRole('button',{name:'再開',exact:true}).click();await tick(page,2);expect((await diagnostics(page)).input.throttle).toBe(0);await expect(page.locator('[data-speed]')).toContainText('mph');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('hashirase:settings:v1:desktop:simulation')).values.speedUnit)).toBe('mph');await home(page);await select(page,'driving');await page.getByRole('button',{name:'設定',exact:true}).click();await expect(page.getByRole('dialog').getByLabel('速度の単位')).toHaveValue('kmh');await info.attach('settings.png',{body:await page.screenshot(),contentType:'image/png'});
});
test('failed_module_can_retry_after_network_recovers',async({page},info)=>{
 await prepare(page);const manifest=JSON.parse(await readFile(new URL('../../dist/build-manifest.json',import.meta.url),'utf8'));let fail=true;await page.route('**/'+manifest.entryPoints['src/modes/simulation/index.js'],route=>fail?route.abort('failed'):route.continue());await page.goto('/');await page.locator('[data-select-mode="simulation"]').click();await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state','ERROR');expect((await diagnostics(page)).activeSession).toBe(0);await expect(page.locator('canvas')).toHaveCount(0);await expect(page.locator('.state-panel')).not.toContainText('http://');await info.attach('load-error.png',{body:await page.screenshot(),contentType:'image/png'});fail=false;await page.getByRole('button',{name:'再試行',exact:true}).click();await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state','RUNNING');await home(page);
});
test('game_help_can_close_while_paused',async({page})=>{
 await prepare(page);await page.goto('/');await select(page,'driving');await page.locator('#btn-help').click();await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state','PAUSED');await expect(page.locator('#help-modal')).toBeVisible();await page.locator('#btn-close-help').click();await expect(page.locator('#help-modal')).not.toBeVisible();await home(page);
});

test('game_RCS_keyboard_holds_and_camera_return_to_driving',async({page})=>{
 await prepare(page);await page.goto('/');await select(page,'driving');const rcs=page.locator('#btn-rcs-spin');await rcs.focus();await page.keyboard.down('Space');await expect(rcs).toHaveAttribute('aria-pressed','true');await page.keyboard.up('Space');await expect(rcs).toHaveAttribute('aria-pressed','false');await page.locator('[data-action="camera"]').click();await page.keyboard.down('KeyW');await tick(page,2);expect((await diagnostics(page)).input.throttle).toBe(1);await page.keyboard.up('KeyW');await home(page);
});
