import { build as esbuild, version as esbuildVersion } from 'esbuild';
import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { assertBoundaries, checkBundleGraph } from './check-boundaries.mjs';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const foundationEntries = ['src/contracts/session.js', 'src/contracts/vehicle.js', 'src/contracts/events.js', 'src/platform/clock.js', 'src/platform/random.js'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = path => path.replaceAll('\\', '/');
const physicalInput = path => slash(path.replace(/^(?:asset-url|asset-file):/, ''));
async function exists(path) { try { await access(path); return true; } catch { return false; } }

// Resolve asset URLs in their own emitted module. This remains correct when the
// owning mode or shared asset module is moved to a chunk or repository subpath.
function assetURLs(rootDir) {
  return {
    name: 'owned-asset-urls',
    setup(build) {
      build.onResolve({ filter: /^hashirase-asset:/ }, args => ({ path: args.path.slice('hashirase-asset:'.length), namespace: 'asset-file' }));
      build.onResolve({ filter: /\.(?:css|svg|png|jpe?g|webp|ogg|mp3|wav|glb)$/ }, args => ({
        path: slash(relative(rootDir, resolve(args.resolveDir, args.path))), namespace: 'asset-url'
      }));
      build.onLoad({ filter: /.*/, namespace: 'asset-url' }, args => ({
        contents: `import path from ${JSON.stringify('hashirase-asset:' + args.path)}; export default new URL(path, import.meta.url).href;`,
        loader: 'js'
      }));
      build.onLoad({ filter: /.*/, namespace: 'asset-file' }, async args => ({
        contents: await readFile(resolve(rootDir, args.path)), loader: 'file'
      }));
    }
  };
}

/**
 * Build only real entrypoints. Before T05, dist is a foundation artifact, not a home.
 * CSS/media are explicit asset URL exports; no stylesheet is applied on import.
 * Asset exports are absolute URLs derived from their own emitted module URL.
 */
export async function buildProject({ rootDir = defaultRoot, entryPoints } = {}) {
  rootDir = resolve(rootDir);
  await assertBoundaries({ rootDir });
  const hasApp = await exists(resolve(rootDir, 'src/app/main.js'));
  entryPoints ??= hasApp ? ['src/app/main.js'] : foundationEntries;
  const result = await esbuild({
    absWorkingDir: rootDir,
    entryPoints, outdir: 'dist', outbase: 'src', entryNames: '[dir]/[name]',
    chunkNames: 'chunks/[name]-[hash]', assetNames: 'assets/[name]-[hash]',
    bundle: true, format: 'esm', splitting: true, platform: 'browser', target: 'es2022',
    metafile: true, write: false, logLevel: 'silent',
    plugins: [assetURLs(rootDir)]
  });
  if (result.warnings.length) throw new Error(result.warnings.map(w => w.text).join('\n'));
  const audit = checkBundleGraph(result.metafile);
  if (audit.violations.length) throw new Error(audit.violations.map(v => `${v.rule}: ${v.output} ${v.input || ''}`).join('\n'));
  const inputFiles = await Promise.all([...new Set(Object.keys(result.metafile.inputs).map(physicalInput))].sort().map(async path => ({
    path: slash(path), sha256: hash(await readFile(resolve(rootDir, path)))
  })));
  const outputs = result.outputFiles.map(file => {
    const path = slash(relative(rootDir, file.path));
    const info = result.metafile.outputs[path];
    return { path, sha256: hash(file.contents), inputs: [...new Set(Object.keys(info.inputs).map(physicalInput))].sort(), imports: info.imports };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const manifest = {
    schemaVersion: 1, phase: hasApp ? 'application' : 'foundation',
    format: 'esm', splitting: true, esbuildVersion,
    entryPoints: Object.fromEntries(Object.entries(result.metafile.outputs).filter(([, out]) => out.entryPoint).map(([path, out]) => [out.entryPoint, path])),
    inputFiles, outputs
  };
  // Validate everything before replacing the old generated directory.
  await rm(resolve(rootDir, 'dist'), { recursive: true, force: true });
  for (const output of result.outputFiles) {
    await mkdir(dirname(output.path), { recursive: true });
    await writeFile(output.path, output.contents);
  }
  await writeFile(resolve(rootDir, 'dist/metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n');
  await writeFile(resolve(rootDir, 'dist/build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { manifest, metafile: result.metafile };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // Preserve the public game while adding the new independent build foundation.
    execFileSync(process.execPath, ['tools/build.mjs'], { cwd: defaultRoot, stdio: 'inherit' });
    const { manifest } = await buildProject();
    console.log(`ESM ${manifest.phase} build: ${manifest.inputFiles.length} inputs, ${manifest.outputs.length} outputs; dist/build-manifest.json.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
