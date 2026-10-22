import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Source parts share one lexical scope and MUST be concatenated in this order.
// They are not standalone JavaScript modules.
const parts = [
  'src/runtime/00-boot-audio.part.js',
  'src/runtime/10-renderer-track.part.js',
  'src/runtime/20-nyc-traffic.part.js',
  'src/runtime/30-utility-poles.part.js',
  'src/runtime/40-time-attack.part.js',
  'src/runtime/50-police-scoring.part.js',
  'src/runtime/60-collisions-damage.part.js',
  'src/runtime/70-vehicle-model.part.js',
  'src/runtime/80-interface-input.part.js',
  'src/runtime/90-world-effects.part.js',
  'src/runtime/99-physics-loop.part.js'
];
const output = resolve(root, 'assets/js/simulator.js');
const contents = await Promise.all(parts.map(part => readFile(resolve(root, part), 'utf8')));
const generated = '\n' + contents.join('');
if (process.argv.includes('--check')) {
  const committed = await readFile(output, 'utf8');
  if (committed !== generated) {
    console.error('The generated bundle is outdated. Run npm run build.');
    process.exitCode = 1;
  } else {
    console.log('Bundle matches all ' + parts.length + ' source parts.');
  }
} else {
  await writeFile(output, generated, 'utf8');
  console.log('Regenerated assets/js/simulator.js.');
}
