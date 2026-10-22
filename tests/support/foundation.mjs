import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

export async function optionalModule(path) {
  const url = new URL('../../' + path, import.meta.url);
  try { return await import(url); } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url === url.href) return {};
    throw error;
  }
}

export function required(module, name) {
  assert.equal(typeof module[name], 'function', `T02 requires ${name}`);
  return module[name];
}

export async function fixture(t, files) {
  const rootDir = await mkdtemp(join(tmpdir(), 'hashirase-t02-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  for (const [path, source] of Object.entries(files)) {
    await mkdir(dirname(join(rootDir, path)), { recursive: true });
    await writeFile(join(rootDir, path), source);
  }
  return rootDir;
}

export function vehicleState() {
  return {
    position: { x: 1, y: 0, z: 2 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: -3 }, angularVelocity: { x: 0, y: 0, z: 0 },
    wheels: [null, null, null, null], damage: { parts: { front: 0 } },
    telemetry: { speed: 3, model: 'contract-fixture', wheelModel: 'not-modelled' }
  };
}
