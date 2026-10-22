import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

const sha = '1306887074e37ad08d66edab1ea4aac875071e37';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function implementation() {
  await assert.doesNotReject(access(new URL('../../scripts/stage-pages.mjs', import.meta.url)), 'Pages must package built JavaScript, not publish the source checkout');
  await assert.doesNotReject(access(new URL('../../scripts/verify-deployment.mjs', import.meta.url)), 'Published bytes and the expected commit must be checked');
  return { ...await import('../../scripts/stage-pages.mjs'), ...await import('../../scripts/verify-deployment.mjs') };
}
async function fixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'hashirase-pages-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const rootDir = join(temp, 'source'), outDir = join(temp, 'site');
  const files = {
    'index.html': '<link rel="stylesheet" href="./styles/controls.css"><link rel="stylesheet" href="./styles/home.css"><script type="module" src="./dist/app/main.js"></script>',
    'styles/controls.css': 'button{min-height:44px}', 'styles/home.css': 'body{background:#101b29}',
    'dist/app/main.js': 'import("../chunks/driving.js");', 'dist/chunks/driving.js': 'export const driving=true;',
    'tests/private.txt': 'DO NOT PUBLISH', '.env': 'DO NOT PUBLISH', 'dist/metafile.json': '{}'
  };
  for (const [path, bytes] of Object.entries(files)) { await mkdir(join(rootDir, path, '..'), { recursive: true }); await writeFile(join(rootDir, path), bytes); }
  const outputs = ['dist/app/main.js', 'dist/chunks/driving.js'].map(path => ({ path, sha256: hash(files[path]), inputs: [], imports: [] }));
  const manifest = { schemaVersion: 1, phase: 'application', entryPoints: { 'src/app/main.js': 'dist/app/main.js' }, outputs };
  await writeFile(join(rootDir, 'dist/build-manifest.json'), JSON.stringify(manifest));
  return { rootDir, outDir, files, manifest };
}

test('pages_artifact_contains_runtime_bytes_commit_and_complete_hashes_without_source_or_secrets', async t => {
  const { stagePages } = await implementation(), f = await fixture(t);
  await stagePages({ ...f, sourceSha: sha });
  const info = JSON.parse(await readFile(join(f.outDir, 'build-info.json')));
  assert.equal(info.sourceSha, sha);
  for (const path of ['index.html', 'styles/controls.css', 'styles/home.css', 'dist/app/main.js', 'dist/chunks/driving.js', 'dist/build-manifest.json', '404.html', '.nojekyll']) {
    const entry = info.files.find(file => file.path === path);
    assert(entry, path);
    assert.equal(entry.sha256, hash(await readFile(join(f.outDir, path))));
  }
  for (const path of ['tests/private.txt', '.env', 'dist/metafile.json']) await assert.rejects(access(join(f.outDir, path)), { code: 'ENOENT' });
  assert.match(await readFile(join(f.outDir, '404.html'), 'utf8'), /href="\/hashirase\/"/);
});

test('pages_packaging_rejects_stale_missing_escaping_or_non_application_builds', async t => {
  const { stagePages } = await implementation(), f = await fixture(t);
  await writeFile(join(f.rootDir, 'dist/chunks/driving.js'), 'stale bytes');
  await assert.rejects(stagePages({ ...f, sourceSha: sha }), /hash|sha256/i);
  await rm(join(f.rootDir, 'dist/chunks/driving.js'));
  await assert.rejects(stagePages({ ...f, sourceSha: sha }), /ENOENT|missing/i);
  f.manifest.outputs[1].path = '../.env';
  await writeFile(join(f.rootDir, 'dist/build-manifest.json'), JSON.stringify(f.manifest));
  await assert.rejects(stagePages({ ...f, sourceSha: sha }), /path|dist/i);
  f.manifest.phase = 'foundation';
  await writeFile(join(f.rootDir, 'dist/build-manifest.json'), JSON.stringify(f.manifest));
  await assert.rejects(stagePages({ ...f, sourceSha: sha }), /application/i);
  await assert.rejects(stagePages({ ...f, sourceSha: 'main' }), /SHA/i);
});

test('deployment_verification_requires_matching_commit_all_bytes_prefix_paths_and_real_404', async t => {
  const { stagePages, verifyDeployment } = await implementation(), f = await fixture(t);
  const expectedManifest = await stagePages({ ...f, sourceSha: sha });
  let fake404 = false;
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      assert(pathname.startsWith('/hashirase/'));
      const bytes = await readFile(join(f.outDir, pathname.slice('/hashirase/'.length) || 'index.html'));
      res.end(bytes);
    } catch { res.writeHead(fake404 ? 200 : 404).end('missing'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseURL = `http://127.0.0.1:${server.address().port}/hashirase/`;
  const result = await verifyDeployment({ baseURL, expectedSha: sha, expectedManifest });
  assert.equal(result.sourceSha, sha);
  assert(result.filesVerified >= 8);
  await assert.rejects(verifyDeployment({ baseURL, expectedSha: 'a'.repeat(40), expectedManifest }), /commit|SHA/i);
  await writeFile(join(f.outDir, 'dist/chunks/driving.js'), 'broken deployed chunk');
  await assert.rejects(verifyDeployment({ baseURL, expectedSha: sha, expectedManifest }), /hash|sha256/i);
  await writeFile(join(f.outDir, 'dist/chunks/driving.js'), f.files['dist/chunks/driving.js']);
  fake404 = true;
  await assert.rejects(verifyDeployment({ baseURL, expectedSha: sha, expectedManifest }), /404/i);
  fake404 = false;
  const coherentWrongSite = { ...expectedManifest, files: expectedManifest.files.filter(file => ['index.html', 'dist/app/main.js'].includes(file.path)) };
  await writeFile(join(f.outDir, 'build-info.json'), JSON.stringify(coherentWrongSite));
  await assert.rejects(verifyDeployment({ baseURL, expectedSha: sha, expectedManifest }), /manifest|artifact|file set/i);
  await assert.rejects(verifyDeployment({ baseURL, expectedSha: sha }), /expected|manifest/i);
});

test('stale_reruns_are_rejected_before_entering_the_shared_deployment_queue', async () => {
  await assert.doesNotReject(access(new URL('../../scripts/release-target.mjs', import.meta.url)), 'Reject stale releases before they can replace the pending latest-main deployment');
  const { isCurrentRelease } = await import('../../scripts/release-target.mjs');
  const current = 'b'.repeat(40), old = 'a'.repeat(40);
  // GitHub replaces an existing pending job even with cancel-in-progress:false.
  // B must survive the later old rerun O; the running deployment is independent.
  const pending = [];
  for (const sourceSha of [current, old]) if (isCurrentRelease({ sourceSha, mainSha: current })) pending.splice(0, pending.length, sourceSha);
  assert.deepEqual(pending, [current]);
  assert.throws(() => isCurrentRelease({ sourceSha: 'main', mainSha: current }), /SHA/i);
  const workflow = await readFile(new URL('../../.github/workflows/verify.yml', import.meta.url), 'utf8');
  assert(!/^concurrency:/m.test(workflow), 'old workflow reruns must not displace the latest main regression run');
  assert.match(workflow, /needs: \[source-check, release-target\]/);
  assert.match(workflow, /needs\.release-target\.outputs\.publish == 'true'/);
});
