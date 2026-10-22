import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { buildProject } from '../../scripts/build.mjs';
import { stagePages } from '../../scripts/stage-pages.mjs';
import { verifyDeployment } from '../../scripts/verify-deployment.mjs';
import { servePages } from '../support/pages-server.mjs';
import { prepareApp, tick, diagnostics } from '../support/app-browser.mjs';

let site, sourceSha, expectedManifest;
test.beforeAll(async () => {
  await buildProject();
  sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  expectedManifest = await stagePages({ sourceSha });
  site = await servePages(resolve('.pages-site'));
});
test.afterAll(async () => { await site?.close(); });

test('pages_artifact_matches_commit_without_access_to_source_checkout', async ({ page }, info) => {
  const result = await verifyDeployment({ baseURL: site.baseURL, expectedSha: sourceSha, expectedManifest });
  expect(result.filesVerified).toBeGreaterThan(20);
  expect((await page.request.get(new URL('src/app/main.js', site.baseURL).href)).status()).toBe(404);
  expect((await page.request.get(new URL('node_modules/three/package.json', site.baseURL).href)).status()).toBe(404);
  const d = await prepareApp(page);
  await page.goto(site.baseURL);
  await expect(page.getByRole('button', { name: 'ゲームをはじめる', exact: true })).toBeVisible();
  expect((await diagnostics(page)).initialized).toEqual({ driving: 0, simulation: 0 });
  const manifest = JSON.parse(await readFile('.pages-site/dist/build-manifest.json', 'utf8'));
  const forbidden = manifest.outputs.filter(output => output.inputs.some(input => /src\/(?:modes|assets)\/(?:driving|simulation)\/|node_modules\/three|src\/rendering\/|src\/platform\/audio/.test(input))).map(output => '/hashirase/' + output.path);
  expect(d.requests.filter(url => forbidden.includes(new URL(url).pathname))).toEqual([]);
  await info.attach('published-home.png', { body: await page.screenshot(), contentType: 'image/png' });
  expect(d.errors).toEqual([]);
});

for (const mode of ['driving', 'simulation']) test(`pages_artifact_${mode}_starts_and_returns_home_at_repository_prefix`, async ({ page }, info) => {
  const d = await prepareApp(page);
  const failed = []; page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  await page.goto(site.baseURL);
  await page.locator(`[data-select-mode="${mode}"]`).click();
  await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state', 'RUNNING');
  await expect(page.locator('canvas')).toHaveCount(1);
  await tick(page, 2);
  expect((await diagnostics(page)).initialized[mode === 'driving' ? 'simulation' : 'driving']).toBe(0);
  await info.attach(`published-${mode}.png`, { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
  await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state', 'HOME');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect((await diagnostics(page)).activeSession).toBe(0);
  expect(d.requests.every(url => new URL(url).pathname.startsWith('/hashirase/'))).toBe(true);
  expect(failed).toEqual([]); expect(d.errors).toEqual([]);
});
