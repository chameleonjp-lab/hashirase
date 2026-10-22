import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { optionalModule, required, fixture } from '../support/foundation.mjs';

const boundaries = await optionalModule('scripts/check-boundaries.mjs');
const builder = await optionalModule('scripts/build.mjs');

test('imports_do_not_cross_modes', async t => {
  const check = required(boundaries, 'checkBoundaries');
  const rootDir = await fixture(t, {
    'src/modes/driving/index.js': "export { model } from '../simulation/index.js';",
    'src/modes/simulation/index.js': 'export const model = 1;'
  });
  const result = await check({ rootDir });
  assert(result.violations.some(v => v.rule === 'cross-mode'));
});

test('common_code_and_static_home_imports_cannot_pull_in_a_mode', async t => {
  const check = required(boundaries, 'checkBoundaries');
  const rootDir = await fixture(t, {
    'src/platform/shared.js': "export const load = () => import('../modes/simulation/index.js');",
    'src/app/main.js': "import '../modes/driving/index.js';",
    'src/modes/driving/index.js': 'export const mode = 1;',
    'src/modes/simulation/index.js': 'export const mode = 2;'
  });
  const result = await check({ rootDir });
  assert(result.violations.some(v => v.rule === 'common-to-mode'));
  assert(result.violations.some(v => v.rule === 'home-static-mode'));
});

test('cycles_and_computed_imports_fail_and_comment_strings_are_not_imports', async t => {
  const check = required(boundaries, 'checkBoundaries');
  const rootDir = await fixture(t, {
    'src/contracts/a.js': "import './b.js'; // import('../modes/driving/index.js')\nexport const text = \"import('fake')\";",
    'src/contracts/b.js': "export * from './a.js';",
    'src/app/main.js': 'export const load = path => import(path);'
  });
  const result = await check({ rootDir });
  assert(result.violations.some(v => v.rule === 'cycle'));
  assert(result.violations.some(v => v.rule === 'computed-import'));
  assert(!result.violations.some(v => /fake/.test(v.to || '')));
});

test('physics_cannot_use_rendering_DOM_audio_storage_or_global_state', async t => {
  const check = required(boundaries, 'checkBoundaries');
  const rootDir = await fixture(t, {
    'src/physics/shared/model.js': "import '../../rendering/view.js'; document.title; new Audio(); localStorage.getItem('x'); globalThis['state'] = {};",
    'src/rendering/view.js': 'export const view = 1;'
  });
  const result = await check({ rootDir });
  assert(result.violations.some(v => v.rule === 'physics-dependency'));
  assert(result.violations.some(v => v.rule === 'physics-global'));
  assert(result.violations.some(v => v.rule === 'global-write'));
});

test('literal_dynamic_imports_are_checked_and_legacy_parts_are_explicitly_excluded', async t => {
  const check = required(boundaries, 'checkBoundaries');
  const rootDir = await fixture(t, {
    'src/app/main.js': "export const load = () => import('../modes/driving/index.js');",
    'src/modes/driving/index.js': 'export const mode = 1;',
    'src/runtime/00-legacy.part.js': 'deliberately invalid legacy fragment {'
  });
  const result = await check({ rootDir });
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.legacyExcluded, ['src/runtime/00-legacy.part.js']);
  assert(result.imports.some(e => e.kind === 'dynamic-import'));
});

const splitFixture = {
  'src/app/main.js': "export const load = id => id === 'driving' ? import('../modes/driving/index.js') : import('../modes/simulation/index.js');",
  'src/contracts/shared.js': 'export const shared = 42;',
  'src/modes/driving/index.js': "import {shared} from '../../contracts/shared.js'; import style from './mode.css'; import image from './car.svg'; export const mode = () => [shared, style, image, 'driving'];",
  'src/modes/simulation/index.js': "import {shared} from '../../contracts/shared.js'; import style from './mode.css'; import image from './car.svg'; export const mode = () => [shared, style, image, 'simulation'];",
  'src/modes/driving/mode.css': '.driving { color: red; }',
  'src/modes/simulation/mode.css': '.simulation { color: blue; }',
  'src/modes/driving/car.svg': '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
  'src/modes/simulation/car.svg': '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>'
};

test('split_build_lists_inputs_and_keeps_unselected_mode_out_of_static_JS_graph', async t => {
  const build = required(builder, 'buildProject');
  const rootDir = await fixture(t, splitFixture);
  const { manifest, metafile } = await build({ rootDir, entryPoints: ['src/app/main.js'] });
  assert.equal(manifest.format, 'esm'); assert.equal(manifest.splitting, true);
  assert.equal(manifest.phase, 'application');
  assert(manifest.inputFiles.some(f => f.path === 'src/modes/driving/index.js'));
  assert(manifest.inputFiles.some(f => f.path === 'src/modes/simulation/car.svg'));
  const home = Object.entries(metafile.outputs).find(([, o]) => o.entryPoint === 'src/app/main.js');
  assert(home);
  assert.equal(home[1].imports.filter(e => e.kind === 'dynamic-import').length, 2);
  assert(!Object.keys(home[1].inputs).some(p => p.includes('/modes/')));
  assert(Object.keys(metafile.outputs).some(p => /chunks\/.+\.js$/.test(p)));
  const audit = required(boundaries, 'checkBundleGraph')(metafile);
  assert.deepEqual(audit.violations, []);
  assert.deepEqual(JSON.parse(await readFile(join(rootDir, 'dist/build-manifest.json'), 'utf8')), manifest);
  // CSS is an explicit asset URL; T05 owns mounting it for the selected session.
});

test('bare_CSS_imports_fail_instead_of_combining_both_modes_into_home_CSS', async t => {
  const check = required(boundaries, 'checkBoundaries');
  const rootDir = await fixture(t, { 'src/modes/driving/index.js': "import './mode.css';", 'src/modes/driving/mode.css': '.car {}' });
  const result = await check({ rootDir });
  assert(result.violations.some(v => v.rule === 'asset-side-effect'));
});

test('build_fails_when_a_common_entry_statically_includes_a_mode', async t => {
  const build = required(builder, 'buildProject');
  const rootDir = await fixture(t, splitFixture);
  await writeFile(join(rootDir, 'src/app/main.js'), "import '../modes/driving/index.js'; export const home = true;");
  await assert.rejects(() => build({ rootDir, entryPoints: ['src/app/main.js'] }), /home-static-mode/);
});

test('bundle_audit_rejects_mode_code_hidden_in_a_shared_chunk', () => {
  const audit = required(boundaries, 'checkBundleGraph');
  const result = audit({ outputs: {
    'dist/app/main.js': { entryPoint: 'src/app/main.js', inputs: { 'src/app/main.js': {} }, imports: [{ path: 'dist/chunks/shared.js', kind: 'import-statement' }] },
    'dist/chunks/shared.js': { inputs: { 'src/modes/driving/physics.js': {}, 'src/modes/simulation/physics/model.js': {} }, imports: [] }
  } });
  assert(result.violations.some(v => v.rule === 'bundle-mixed-modes'));
  assert(result.violations.some(v => v.rule === 'bundle-home-mode'));
});
