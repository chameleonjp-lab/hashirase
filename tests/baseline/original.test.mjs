import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('tests/fixtures/original-manifest.json', root)));
const html = await readFile(new URL('legacy.html', root), 'utf8');
const app = await readFile(new URL('assets/js/simulator.js', root), 'utf8');

test('original_manifest_identifies_immutable_baseline_sources', () => {
  for (const source of manifest.sources) {
    const bytes = execFileSync('git', ['show', `${manifest.sourceRef}:${source.path}`], { cwd: root });
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256, source.path);
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), source.gitBlob, source.path);
  }
  const original = execFileSync('git', ['show', `${manifest.originalHtml.commit}:index.html`], { cwd: root });
  assert.equal(createHash('sha256').update(original).digest('hex'), manifest.originalHtml.sha256);
});

test('original_screen_controls_and_asset_order_are_preserved', () => {
  assert.deepEqual([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]), manifest.elementIds);
  assert.deepEqual([...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(m => m[1]), manifest.localAssets);
  assert.deepEqual([...html.matchAll(/(?:src|href)="(https:\/\/[^"]+)"/g)].map(m => m[1]), manifest.externalAssets);
});

test('original_courses_trims_constants_and_core_features_are_preserved', () => {
  for (const name of manifest.courses) assert(app.includes(`'${name}'`), name);
  for (const name of manifest.trims) assert(app.includes(`${name}: {`), name);
  for (const [name, value] of Object.entries(manifest.constants)) {
    const found = app.match(new RegExp(`const ${name} = ([0-9.]+)`));
    assert(found, name);
    assert.equal(Number(found[1]), value, name);
  }
  for (const name of manifest.functionMarkers) assert(app.includes(`function ${name}(`), name);
});
