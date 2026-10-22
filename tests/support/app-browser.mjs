// Deterministic RAF for ownership/input checks on the software GPU. These tests
// do not measure wall-clock frame rate or physical-device latency.
export async function prepareApp(page){
 const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(String(e)));await page.route('https://**/*',r=>r.abort());
 await page.addInitScript(()=>{const callbacks=new Map();let id=0,now=0;window.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);window.__appTick=(milliseconds=1000/60)=>{now+=milliseconds;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);return callbacks.size;};});return{requests,errors};
}
export async function tick(page,frames=1,dt=1000/60){for(let i=0;i<frames;i++)await page.evaluate(ms=>window.__appTick(ms),dt);}
export async function diagnostics(page){return page.evaluate(async()=>{const script=document.querySelector('script[type=module][src]');return(await import(script.src)).appDiagnostics();});}
