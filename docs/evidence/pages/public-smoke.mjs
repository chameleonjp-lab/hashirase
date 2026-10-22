// Run with NODE_USE_ENV_PROXY=1 on this managed executor. The session CA is
// trusted by Node, so HTTPS requests use TLS-verified fetch, then Chromium renders
// the unmodified public response bytes at their real origin. TLS is not disabled.
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prepareApp, tick, diagnostics } from '../../../tests/support/app-browser.mjs';
import { verifyDeployment } from '../../../scripts/verify-deployment.mjs';

const sourceSha = process.argv[2], expectedPath = process.argv[3];
const baseURL = 'https://chameleonjp-lab.github.io/hashirase/';
const out = fileURLToPath(new URL('./', import.meta.url));
const expectedManifest = JSON.parse(await readFile(expectedPath, 'utf8'));
const verified = await verifyDeployment({ baseURL, expectedSha: sourceSha, expectedManifest });
const manifest = await (await fetch(baseURL + 'dist/build-manifest.json?sha=' + sourceSha, { cache: 'no-store' })).json();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', args: ['--enable-unsafe-swiftshader'] });
const cases = [];
try {
  await mkdir(out + 'images', { recursive: true });
  for (const mode of ['home', 'driving', 'simulation']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage(), d = await prepareApp(page), responses = [];
    await page.route(baseURL + '**', async route => {
      const response = await fetch(route.request().url(), { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      responses.push({ url: response.url, status: response.status });
      await route.fulfill({ status: response.status, contentType: response.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await response.arrayBuffer()) });
    });
    await page.goto(baseURL + '?verify=' + sourceSha);
    await expect(page.getByRole('button', { name: 'ゲームをはじめる', exact: true })).toBeVisible();
    let live = await diagnostics(page);
    expect(live.initialized).toEqual({ driving: 0, simulation: 0 });
    const forbidden = manifest.outputs.filter(output => output.inputs.some(input => mode === 'home'
      ? /src\/(?:modes|assets)\/(?:driving|simulation)\/|node_modules\/three|src\/rendering\/|src\/platform\/audio/.test(input)
      : input.includes(`/modes/${mode === 'driving' ? 'simulation' : 'driving'}/`) || input.includes(`/assets/${mode === 'driving' ? 'simulation' : 'driving'}/`) || (mode === 'simulation' && /node_modules\/three|src\/rendering\/|src\/platform\/audio/.test(input)))).map(output => '/hashirase/' + output.path);
    if (mode !== 'home') {
      await page.locator(`[data-select-mode="${mode}"]`).click();
      await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state', 'RUNNING');
      await expect(page.locator('canvas')).toHaveCount(1);
      await page.keyboard.down('KeyW'); await tick(page, 4); await page.keyboard.up('KeyW'); await tick(page, 2);
      live = await diagnostics(page);
      expect(live.activeSession).toBe(1);
      expect(live.initialized[mode === 'driving' ? 'simulation' : 'driving']).toBe(0);
    }
    expect(d.requests.filter(url => forbidden.includes(new URL(url).pathname))).toEqual([]);
    await page.screenshot({ path: out + `images/live-${mode}.png` });
    if (mode !== 'home') {
      await page.getByRole('button', { name: 'ホームへ', exact: true }).click();
      await expect(page.locator('[data-app-state]')).toHaveAttribute('data-app-state', 'HOME');
      await expect(page.locator('canvas')).toHaveCount(0);
    }
    const after = await diagnostics(page);
    expect(after.activeSession).toBe(0); expect(after.activeRAF).toBe(0);
    expect(responses.filter(response => response.status >= 400)).toEqual([]);
    expect(d.errors).toEqual([]);
    cases.push({ mode, live, after, forbiddenRequests: 0, responses, errors: d.errors });
    await context.close();
  }
  const report = { sourceSha, url: baseURL, verified, browser: await browser.version(), transport: 'TLS-verified Node fetch through session proxy; unmodified responses rendered at public origin', manualRAF: true, physicalDevice: false, cases };
  await writeFile(out + 'public-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ sourceSha, verified, browserCases: cases.length, forbiddenRequests: 0, errors: 0 }));
} finally { await browser.close(); }
