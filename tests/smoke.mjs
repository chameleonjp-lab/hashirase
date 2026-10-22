import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(resolve(root, 'legacy.html'), 'utf8');
const localAssets = [
  'assets/css/simulator.css',
  'assets/js/bootstrap/loading.js',
  'assets/js/bootstrap/three-loader.js',
  'assets/js/engine/software-fallback.js',
  'assets/js/simulator.js'
];
assert.deepEqual([...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(m => m[1]), localAssets,
  'Local file order must stay the same.');
for (const path of localAssets) await access(resolve(root, path));
assert(!/<style\b/.test(html), 'Styles belong in assets/css.');
for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  assert(!m[1].trim(), 'Scripts belong in assets/js.');
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate element id');
for (const id of [
  'loading-screen', 'canvas-container', 'cockpit-hud', 'top-scroll-strip',
  'btn-accel', 'btn-brake', 'btn-steer-left', 'btn-steer-right',
  'btn-toggle-course', 'btn-time-attack', 'gameover-modal', 'help-modal'
]) assert(ids.includes(id), 'Missing control: ' + id);
const app = await readFile(resolve(root, 'assets/js/simulator.js'), 'utf8');
for (const marker of [
  'function buildProvingGroundAndRamp()',
  'function buildNewYorkCityCourse()',
  'function updatePolicePursuitSystem(dt)',
  'function stepPhysics(dt)',
  'function animate(now)'
]) assert(app.includes(marker), 'Missing game function: ' + marker);
assert(html.indexOf('three.min.js') < html.indexOf('software-fallback.js'),
  'Three.js loading order changed');
const home = await readFile(resolve(root,'index.html'),'utf8');
assert(home.includes('dist/app/main.js'),'Home must use the isolated application entry');
assert(!/assets\/js\/|three\.min|tailwindcss\.com/.test(home),'Home must not load legacy or 3D programs');
console.log('Smoke test passed: ' + ids.length + ' unique IDs and expected asset order.');
