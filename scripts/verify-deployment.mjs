import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSitePath } from './stage-pages.mjs';

export async function verifyDeployment({ baseURL, expectedSha }) {
  if (!/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error('A full expected commit SHA is required');
  const base = new URL(baseURL);
  if (!['http:', 'https:'].includes(base.protocol) || !base.pathname.endsWith('/') || base.search || base.hash) throw new Error('Deployment URL must be an HTTP directory ending in /');
  const get = path => {
    const url = new URL(path, base); url.searchParams.set('sha', expectedSha);
    return fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  };
  const response = await get(`build-info.json?sha=${expectedSha}`);
  if (!response.ok) throw new Error(`Build information returned HTTP ${response.status}`);
  const info = await response.json();
  if (info.schemaVersion !== 1 || info.sourceSha !== expectedSha) throw new Error(`Deployed commit SHA mismatch: expected ${expectedSha}, got ${info.sourceSha}`);
  if (!Array.isArray(info.files) || !info.files.some(f => f.path === 'index.html') || !info.files.some(f => f.path === 'dist/app/main.js')) throw new Error('Incomplete deployment manifest');
  const seen = new Set();
  for (const file of info.files) {
    if (!isSitePath(file.path) || seen.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error(`Invalid deployment manifest path or sha256: ${file.path}`);
    seen.add(file.path);
    const result = await get(file.path);
    if (!result.ok) throw new Error(`Runtime file returned HTTP ${result.status}: ${file.path}`);
    const actual = createHash('sha256').update(Buffer.from(await result.arrayBuffer())).digest('hex');
    if (actual !== file.sha256) throw new Error(`Deployed sha256 mismatch: ${file.path}`);
  }
  const missing = await get(`__hashirase_missing_${expectedSha}.html`);
  if (missing.status !== 404) throw new Error(`Missing path must return HTTP 404, got ${missing.status}`);
  return { url: base.href, sourceSha: info.sourceSha, filesVerified: info.files.length, missingStatus: missing.status };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
    console.log(JSON.stringify(await verifyDeployment({ baseURL: args.includes('--url') ? value('--url') : 'https://chameleonjp-lab.github.io/hashirase/', expectedSha: args.includes('--expected-sha') ? value('--expected-sha') : '' })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
