import { readFile, writeFile, mkdir, rm, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function isSitePath(path) {
  return typeof path === 'string' && /^[\w./-]+$/.test(path) && !path.split('/').some(part => !part || part === '.' || part === '..');
}
async function readRegular(path) {
  if (!(await lstat(path)).isFile()) throw new Error(`Not a regular runtime file: ${path}`);
  return readFile(path);
}

/** Stage an allowlist of built runtime files; never upload the repository root. */
export async function stagePages({ rootDir = root, outDir = resolve(rootDir, '.pages-site'), sourceSha } = {}) {
  rootDir = resolve(rootDir); outDir = resolve(outDir);
  sourceSha ??= execFileSync('git', ['-C', rootDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('A full source commit SHA is required');
  if (outDir === rootDir || rootDir.startsWith(outDir + sep) || (outDir.startsWith(rootDir + sep) && outDir !== resolve(rootDir, '.pages-site'))) throw new Error('Unsafe Pages output path; use .pages-site or a separate output directory');
  const manifestBytes = await readRegular(resolve(rootDir, 'dist/build-manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.phase !== 'application' || manifest.entryPoints?.['src/app/main.js'] !== 'dist/app/main.js' || !Array.isArray(manifest.outputs) || !manifest.outputs.length) throw new Error('Build the complete application before staging Pages');
  const files = new Map([['dist/build-manifest.json', manifestBytes]]);
  for (const output of manifest.outputs) {
    if (!isSitePath(output.path) || !output.path.startsWith('dist/') || files.has(output.path)) throw new Error(`Invalid or duplicate build output path: ${output.path}`);
    const bytes = await readRegular(resolve(rootDir, output.path));
    if (hash(bytes) !== output.sha256) throw new Error(`Build sha256 mismatch: ${output.path}`);
    files.set(output.path, bytes);
  }
  if (!files.has('dist/app/main.js')) throw new Error('Application entry is missing from build outputs');
  const index = await readRegular(resolve(rootDir, 'index.html'));
  files.set('index.html', index);
  for (const [, target] of index.toString().matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    if (target.startsWith('data:')) continue;
    const path = target.replace(/^\.\//, '');
    if (!isSitePath(path)) throw new Error(`Index reference must work below the repository path: ${target}`);
    if (files.has(path)) continue;
    if (!/^styles\/[\w.-]+\.css$/.test(path)) throw new Error(`Index reference is not a built runtime file: ${path}`);
    files.set(path, await readRegular(resolve(rootDir, path)));
  }
  files.set('.nojekyll', Buffer.from(''));
  files.set('404.html', Buffer.from('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ページが見つかりません — HASHIRASE</title><h1>ページが見つかりません</h1><p><a href="/hashirase/">HASHIRASEのホームへ</a></p></html>\n'));
  const info = { schemaVersion: 1, sourceSha, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, sha256: hash(bytes) })) };
  // All inputs are validated before replacing the previous staging directory.
  await rm(outDir, { recursive: true, force: true });
  for (const [path, bytes] of files) { await mkdir(dirname(resolve(outDir, path)), { recursive: true }); await writeFile(resolve(outDir, path), bytes); }
  await writeFile(resolve(outDir, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
  return info;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
    const options = { rootDir: args.includes('--root') ? value('--root') : root };
    if (args.includes('--out')) options.outDir = value('--out');
    if (args.includes('--source-sha')) options.sourceSha = value('--source-sha');
    const info = await stagePages(options);
    console.log(`Pages staged: ${info.sourceSha}, ${info.files.length} runtime files`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
