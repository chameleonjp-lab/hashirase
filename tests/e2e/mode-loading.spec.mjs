import {test,expect} from '@playwright/test';import {readFile} from 'node:fs/promises';
async function prepare(page){const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(String(e)));await page.route('https://**/*',r=>r.abort());return{requests,errors};}
async function diagnostics(page){return page.evaluate(async()=>{const script=document.querySelector('script[type=module][src]');return(await import(script.src)).appDiagnostics();});}
async function select(page,mode){await page.locator(`[data-select-mode="${mode}"]`).click();await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state','RUNNING');await expect(page.locator('canvas')).toHaveCount(1);}
async function home(page){await page.getByRole('button',{name:'ホームへ',exact:true}).click();await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state','HOME');await expect(page.locator('canvas')).toHaveCount(0);}
test('home_requests_no_3d',async({page},info)=>{
 const d=await prepare(page);await page.goto('/');await expect(page.getByRole('button',{name:'ゲームをはじめる',exact:true})).toBeVisible();
 expect(d.requests.filter(url=>/three|assets\/js\/simulator|modes\/(driving|simulation)|legacy-adapter/.test(url))).toEqual([]);
 await expect(page.getByRole('button',{name:'シミュレーターをはじめる',exact:true})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);expect((await diagnostics(page)).initialized).toEqual({driving:0,simulation:0});
 await info.attach('home.png',{body:await page.screenshot(),contentType:'image/png'});expect(d.errors).toEqual([]);
});
for(const mode of ['driving','simulation'])test(`${mode}_does_not_fetch_${mode==='driving'?'simulation':'driving'}`,async({page},info)=>{
 const d=await prepare(page);const manifest=JSON.parse(await readFile(new URL('../../dist/build-manifest.json',import.meta.url),'utf8'));const opposite=mode==='driving'?'simulation':'driving';
 const forbidden=manifest.outputs.filter(output=>output.inputs.some(input=>input.includes(`/modes/${opposite}/`)||input.includes(`/assets/${opposite}/`))).map(output=>'/'+output.path);
 await page.goto('/');await select(page,mode);expect(d.requests.filter(url=>forbidden.some(path=>new URL(url).pathname===path))).toEqual([]);
 const state=await diagnostics(page);expect(state.initialized[opposite]).toBe(0);expect(state.activeSession).toBe(1);expect(state.activeRAF).toBeLessThanOrEqual(1);
 await info.attach(mode+'.png',{body:await page.screenshot(),contentType:'image/png'});await home(page);expect((await diagnostics(page)).activeSession).toBe(0);expect((await diagnostics(page)).activeRAF).toBe(0);expect(d.errors).toEqual([]);
 await info.attach(mode+'-network.json',{body:JSON.stringify({requests:d.requests,forbidden,diagnostics:await diagnostics(page)}),contentType:'application/json'});
});
test('mode_round_trips_and_inputs_remain_owned',async({page})=>{
 const d=await prepare(page);await page.goto('/');for(let i=0;i<3;i++)for(const mode of ['driving','simulation']){await select(page,mode);await page.keyboard.down('KeyW');await page.waitForTimeout(120);await page.keyboard.up('KeyW');await page.getByRole('button',{name:'一時停止',exact:true}).click();await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state','PAUSED');await page.getByRole('button',{name:'再開',exact:true}).click();await home(page);}
 expect(d.errors).toEqual([]);expect((await diagnostics(page)).maxActiveSession).toBe(1);expect((await diagnostics(page)).maxCanvas).toBe(1);
});
