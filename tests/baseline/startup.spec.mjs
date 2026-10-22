import { test, expect } from '@playwright/test';
import { prepareBaseline, attachDiagnostics } from '../support/baseline-browser.mjs';

test('startup_nyc_has_no_unbound_radius', async ({ page }, testInfo) => {
  const diagnostics = await prepareBaseline(page);
  try {
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden();
    await expect(page.locator('#canvas-container canvas')).toHaveCount(1);
    const initial = await page.evaluate(() => window.__baseline.snapshot());
    expect(initial.course).toBe('PROVING_GROUND');
    expect(initial.renderCalls).toBeGreaterThan(0);
    await testInfo.attach('proving-ground.png', { body: await page.screenshot(), contentType: 'image/png' });

    await page.locator('#btn-toggle-course').click();
    await expect(page.locator('#course-label-text')).toContainText('NY市街地');
    const frames = await page.evaluate(() => Array.from({ length: 3 }, () => window.__baselineTick()));
    expect(frames.flatMap(f => f.errors), 'City physics/traffic/poles must run without ReferenceError').toEqual([]);
    expect(frames.every(f => f.callbacks === 1)).toBe(true);
    expect(await page.evaluate(() => window.__baseline.snapshot().course)).toBe('NYC');
    await testInfo.attach('nyc.png', { body: await page.screenshot(), contentType: 'image/png' });

    await page.locator('#btn-reset-car').click();
    const reset = await page.evaluate(() => window.__baseline.snapshot());
    expect(reset.car).toEqual({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, hp: 1000 });
    expect((await page.evaluate(() => window.__baselineTick())).errors).toEqual([]);
    await testInfo.attach('nyc-reset.png', { body: await page.screenshot(), contentType: 'image/png' });
    await page.locator('#btn-toggle-course').click();
    expect(await page.evaluate(() => window.__baseline.snapshot().car.z)).toBe(36);
    expect((await page.evaluate(() => window.__baselineTick())).errors).toEqual([]);
    expect(diagnostics.errors).toEqual([]);
    expect(diagnostics.console.filter(m => m.type === 'error')).toEqual([]);
  } finally {
    await attachDiagnostics(page, testInfo, diagnostics);
  }
});

for (const entry of ['timer', 'load']) {
  test(`startup_failure_shows_error (${entry})`, async ({ page }, testInfo) => {
    const diagnostics = await prepareBaseline(page, { fault: true, entry, observe: false });
    try {
      await page.goto('/');
      await expect.poll(() => diagnostics.errors.length + diagnostics.console.filter(m => m.type === 'error').length).toBeGreaterThan(0);
      await expect(page.locator('#loading-screen')).toBeVisible();
      await expect(page.locator('#loading-phase-label')).toContainText('ERROR');
      await expect(page.locator('#loading-title')).toContainText('起動に失敗');
      await expect(page.locator('#loading-pct-num')).not.toHaveText('100%');
      const calls = await page.evaluate(() => window.__baselineGaugeCalls);
      expect(calls.filter(([pct, step, phase]) => pct === 100 || /起動完了|READY|COMPLETE/.test(step + phase))).toEqual([]);
      expect(await page.evaluate(() => window.__baselineFrameCount())).toBe(0);
      expect(diagnostics.errors, 'Both startup entry points must catch rejected initialization').toEqual([]);
      expect(diagnostics.console.some(m => /T01 forced scene failure/.test(m.text))).toBe(true);
      await testInfo.attach(`startup-error-${entry}.png`, { body: await page.screenshot(), contentType: 'image/png' });
    } finally {
      await attachDiagnostics(page, testInfo, diagnostics);
    }
  });
}

test('vehicle_reset_restores_part_positions', async ({ page }, testInfo) => {
  const diagnostics = await prepareBaseline(page);
  try {
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden();
    const initial = await page.evaluate(() => window.__baseline.snapshot().traffic);
    expect(initial).toHaveLength(85);
    expect([...new Set(initial.map(v => v.type))].sort()).toEqual(['SEDAN', 'TRUCK']);
    await page.evaluate(() => window.__baseline.damageTraffic());
    expect(await page.evaluate(() => window.__baseline.snapshot().traffic)).not.toEqual(initial);
    await page.locator('#btn-reset-car').click();
    const restored = await page.evaluate(() => window.__baseline.snapshot().traffic);
    const mismatches = restored.flatMap((v, i) => v.parts.filter((p, j) =>
      JSON.stringify(p) !== JSON.stringify(initial[i].parts[j])).map(p => `${v.type}:${v.id}:${p.role}`));
    expect(mismatches, 'Every sedan/truck part must restore its configured position, rotation and scale').toEqual([]);
    await page.locator('#btn-reset-car').click();
    expect(await page.evaluate(() => window.__baseline.snapshot().traffic)).toEqual(initial);
    expect(diagnostics.errors).toEqual([]);
    await testInfo.attach('traffic-reset.png', { body: await page.screenshot(), contentType: 'image/png' });
  } finally {
    await attachDiagnostics(page, testInfo, diagnostics);
  }
});
