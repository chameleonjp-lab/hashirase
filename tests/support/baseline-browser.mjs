import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const root = new URL('../../', import.meta.url);
const three = await readFile(new URL('node_modules/three/build/three.min.js', root), 'utf8');
const bundle = await readFile(new URL('assets/js/simulator.js', root), 'utf8');
const css = (await postcss([tailwindcss({
  content: [new URL('index.html', root).pathname, new URL('src/runtime/*.js', root).pathname]
})]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined })).css;

// Test-only observation of the real legacy closure. Never shipped in the bundle.
// One real RAF callback is driven per tick to keep software GPU test runs bounded.
const probe = `
window.__baseline = {
  snapshot() {
    return {
      course: currentCourse,
      car: { x: carState.x, y: carState.y, z: carState.z, vx: carState.vx, vy: carState.vy, vz: carState.vz, hp: carState.hp },
      traffic: nycTrafficVehicles.map(v => ({
        id: v.id, type: v.vehicleType,
        parts: v.bodyPartsGroup.children.map(p => ({ role: p.userData.partRole,
          position: p.position.toArray(), rotation: [p.rotation.x, p.rotation.y, p.rotation.z], scale: p.scale.toArray() }))
      })),
      renderCalls: renderer.info.render.calls
    };
  },
  damageTraffic() {
    nycTrafficVehicles.forEach(v => {
      applyLocalizedInertiaCrashDamage(v, v.x, v.z - v.halfL, 0, 9000, 30);
      v.bodyPartsGroup.children.forEach(p => {
        p.position.add(new THREE.Vector3(0.3, -0.2, 0.5));
        p.rotation.x += 0.2; p.rotation.y -= 0.3; p.rotation.z += 0.1;
        p.scale.set(0.7, 0.8, 0.9);
      });
    });
  }
};
`;
const anchor = 'stepPhysics(0.016);\nupdateCamera(0.016);';
assert.equal(bundle.split(anchor).length, 2, 'Legacy observation anchor must be unique');

export async function prepareBaseline(page, { fault = false, entry = 'load', observe = true } = {}) {
  const diagnostics = { errors: [], console: [], requests: [] };
  page.on('pageerror', error => diagnostics.errors.push(error.message));
  page.on('console', msg => diagnostics.console.push({ type: msg.type(), text: msg.text() }));
  page.on('request', request => diagnostics.requests.push(request.url()));
  await page.addInitScript(({ entry }) => {
    let seed = 0x48415348;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const callbacks = new Map();
    let id = 0;
    let simNow;
    window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
    window.cancelAnimationFrame = frameId => callbacks.delete(frameId);
    window.__baselineTick = () => {
      simNow ??= performance.now();
      simNow += 1000 / 60;
      const frames = [...callbacks.values()];
      callbacks.clear();
      const errors = [];
      for (const callback of frames) {
        try { callback(simNow); } catch (err) { errors.push(err.message); }
      }
      return { callbacks: frames.length, errors };
    };
    window.__baselineFrameCount = () => callbacks.size;
    if (entry === 'timer') {
      window.addEventListener('load', event => event.stopImmediatePropagation(), { once: true, capture: true });
    }
    window.__baselineGaugeCalls = [];
    window.addEventListener('DOMContentLoaded', () => {
      const original = window.__setLoadingGauge;
      window.__setLoadingGauge = (...args) => {
        window.__baselineGaugeCalls.push(args);
        return original(...args);
      };
    }, { once: true });
  }, { entry });
  // Fixed, real r128 and Tailwind 3.4.17, served offline for repeatable tests.
  // These fixtures do not test CDN availability or production transfer size.
  await page.route('https://**/*', async route => {
    const url = route.request().url();
    if (/three(?:\.min)?\.js$/.test(url)) {
      await route.fulfill({ contentType: 'text/javascript', body: three + (fault
        ? '\nTHREE.Scene = class { constructor() { throw new Error("T01 forced scene failure"); } };' : '') });
    } else if (url === 'https://cdn.tailwindcss.com/3.4.17') {
      await route.fulfill({ contentType: 'text/javascript', body: `const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.appendChild(s);` });
    } else {
      throw new Error('Unexpected external request in baseline test: ' + url);
    }
  });
  if (observe) {
    await page.route('**/assets/js/simulator.js', route => route.fulfill({
      contentType: 'text/javascript', body: bundle.replace(anchor, probe + anchor)
    }));
  }
  return diagnostics;
}

export async function attachDiagnostics(page, testInfo, diagnostics) {
  const observed = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    seed: 0x48415348,
    gaugeCalls: window.__baselineGaugeCalls,
    pendingFrames: window.__baselineFrameCount?.(),
    snapshot: window.__baseline?.snapshot()
  })).catch(error => ({ error: error.message }));
  await testInfo.attach('baseline-observed.json', {
    body: JSON.stringify({ ...diagnostics, observed }, null, 2), contentType: 'application/json'
  });
}
