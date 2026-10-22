import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, relative, dirname, extname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const slash = value => value.replaceAll('\\', '/');
const modeOf = path => slash(path).match(/(?:^|\/)(?:modes|assets|styles|public)\/(driving|simulation)(?:\/|\.|$)/)?.[1];
const isPhysics = path => /(?:^|\/)physics(?:\/|\.js$)/.test(path);
const unsafePhysicsPath = path => /(?:^|\/)(?:rendering|ui)\/|(?:^|\/)platform\/(?:audio|input|settings|record|storage|device)/.test(path) || /(?:^|\/)three(?:\/|$)/.test(path);
const isJS = path => /\.m?js$/.test(path);
const globalNames = new Set(['window', 'globalThis', 'global', 'self']);
const physicsGlobals = new Set(['window', 'document', 'navigator', 'Audio', 'AudioContext', 'webkitAudioContext', 'localStorage', 'sessionStorage', 'THREE', 'Date', 'performance']);
function walk(node, visit, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node, parent);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) walk(child, visit, node);
    else if (value && typeof value === 'object') walk(value, visit, node);
  }
}
function rootName(node) {
  while (node?.type === 'MemberExpression' || node?.type === 'ChainExpression') node = node.object || node.expression;
  return node?.type === 'Identifier' ? node.name : null;
}
function propertyName(node) {
  return node?.computed ? node.property?.value : node?.property?.name;
}
function reference(node, parent) {
  return !((parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
    (parent?.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand));
}
async function sourceFiles(rootDir) {
  const files = []; const legacyExcluded = [];
  async function scan(path) {
    let entries;
    try { entries = await readdir(resolve(rootDir, path), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const item of entries) {
      const child = `${path}/${item.name}`;
      if (item.isDirectory()) await scan(child);
      else if (item.isFile() && isJS(child)) {
        if (child.startsWith('src/runtime/') && child.endsWith('.part.js')) legacyExcluded.push(child);
        else files.push(child);
      }
    }
  }
  await scan('src');
  return { files: files.sort(), legacyExcluded: legacyExcluded.sort() };
}

/** Parse imports/re-exports/dynamic imports; regex matches in strings are not edges. */
export async function checkBoundaries({ rootDir = defaultRoot } = {}) {
  rootDir = resolve(rootDir);
  const { files, legacyExcluded } = await sourceFiles(rootDir);
  const imports = []; const violations = []; const capabilities = new Map();
  const add = (rule, from, to, message = '') => violations.push({ rule, from, to, message });
  for (const from of files) {
    const uses = { globals: new Set(), loops: new Set(), random: false };
    capabilities.set(from, uses);
    let ast;
    try { ast = parse(await readFile(resolve(rootDir, from), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' }); }
    catch (error) { add('parse-error', from, '', error.message); continue; }
    const candidates = [];
    walk(ast, (node, parent) => {
      let source; let kind = 'import-statement';
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) source = node.source;
      if (node.type === 'ImportExpression') { source = node.source; kind = 'dynamic-import'; }
      if (source) {
        const specifier = source.type === 'Literal' ? source.value :
          source.type === 'TemplateLiteral' && source.expressions.length === 0 ? source.quasis[0].value.cooked : null;
        if (typeof specifier !== 'string') add('computed-import', from, '', 'Use literal, allowlisted module paths');
        else {
          candidates.push({ specifier, kind });
          if (/\.(?:css|svg|png|jpe?g|webp|ogg|mp3|wav)$/.test(specifier) && node.type === 'ImportDeclaration' && node.specifiers.length === 0) {
            add('asset-side-effect', from, specifier, 'Import an explicit asset URL; the selected session owns mounting');
          }
        }
      }
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') add('commonjs', from, '', 'New source modules use ESM');
      if (node.type === 'Identifier' && reference(node, parent)) {
        if (physicsGlobals.has(node.name)) uses.globals.add(node.name);
        if (['requestAnimationFrame', 'setInterval'].includes(node.name)) uses.loops.add(node.name);
      }
      if (node.type === 'MemberExpression') {
        if (globalNames.has(rootName(node)) && physicsGlobals.has(propertyName(node))) uses.globals.add(propertyName(node));
        if (rootName(node) === 'Math' && propertyName(node) === 'random') uses.random = true;
        if (globalNames.has(rootName(node)) && ['requestAnimationFrame', 'setInterval'].includes(propertyName(node))) uses.loops.add(propertyName(node));
      }
      if (['AssignmentExpression', 'UpdateExpression', 'UnaryExpression'].includes(node.type)) {
        const target = node.left || node.argument;
        if ((node.type !== 'UnaryExpression' || node.operator === 'delete') && target?.type === 'MemberExpression' && globalNames.has(rootName(target))) add('global-write', from, rootName(target));
      }
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
          ['Object', 'Reflect'].includes(rootName(node.callee)) && ['assign', 'defineProperty', 'defineProperties', 'set'].includes(propertyName(node.callee)) &&
          globalNames.has(rootName(node.arguments[0]))) add('global-write', from, rootName(node.arguments[0]));
    });
    for (const { specifier, kind } of candidates) {
      let to;
      if (specifier.startsWith('.')) {
        to = slash(relative(rootDir, resolve(rootDir, dirname(from), specifier)));
        if (to.startsWith('../') || (isJS(to) && !to.startsWith('src/'))) add('outside-source', from, to);
        try { await access(resolve(rootDir, to)); } catch { add('missing-import', from, to); }
        if (to.startsWith('src/runtime/')) add('legacy-import', from, to, 'Legacy fragments are not ESM modules');
      } else {
        to = specifier;
        if (!(from.startsWith('src/rendering/') && /^three(?:\/|$)/.test(to))) add('external-import', from, to, 'Only pinned Three.js in rendering is allowed');
      }
      imports.push({ from, to, kind });
      const fromMode = modeOf(from); const toMode = modeOf(to);
      if (fromMode && toMode && fromMode !== toMode) add('cross-mode', from, to);
      if (!fromMode && !from.startsWith('src/app/') && toMode) add('common-to-mode', from, to);
      if (from.startsWith('src/app/') && toMode && kind !== 'dynamic-import') add('home-static-mode', from, to);
      if (!from.startsWith('src/app/') && to.startsWith('src/app/')) add('reverse-app', from, to);
      if (fromMode && /^src\/(?:rendering|ui)\//.test(to)) add('mode-view-dependency', from, to, 'Inject the renderer through context');
      if (from.startsWith('src/rendering/') && to.startsWith('src/') && !/^src\/(?:rendering|contracts|assets)\//.test(to)) add('rendering-dependency', from, to);
      if (from.startsWith('src/contracts/') && to.startsWith('src/') && !to.startsWith('src/contracts/')) add('contract-dependency', from, to);
    }
  }
  const graph = new Map(files.map(f => [f, imports.filter(e => e.from === f && files.includes(e.to)).map(e => e.to)]));
  const colors = new Map();
  function visit(file, stack) {
    if (colors.get(file) === 1) { add('cycle', stack.at(-1), file, [...stack, file].join(' -> ')); return; }
    if (colors.get(file) === 2) return;
    colors.set(file, 1);
    for (const next of graph.get(file) || []) visit(next, [...stack, file]);
    colors.set(file, 2);
  }
  for (const file of files) visit(file, []);
  for (const file of files.filter(file => isPhysics(file) || modeOf(file))) {
    const seen = new Set(); const pending = [file];
    while (pending.length) {
      const current = pending.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      const uses = capabilities.get(current);
      if (isPhysics(file)) {
        for (const name of uses?.globals || []) add('physics-global', file, `${current}:${name}`);
        if (uses?.random) add('physics-random', file, `${current}:Math.random`, 'Use the injected seeded physics stream');
      }
      if (modeOf(file)) for (const name of uses?.loops || []) add('mode-loop', file, `${current}:${name}`, 'Only the host owns the render loop/clock');
      for (const edge of imports.filter(e => e.from === current)) {
        if (isPhysics(file) && unsafePhysicsPath(edge.to)) add('physics-dependency', file, edge.to);
        if (files.includes(edge.to)) pending.push(edge.to);
      }
    }
  }
  return { files, legacyExcluded, imports, violations };
}

export async function assertBoundaries(options) {
  const report = await checkBoundaries(options);
  if (report.violations.length) throw new Error(report.violations.map(v => `${v.rule}: ${v.from} -> ${v.to} ${v.message}`).join('\n'));
  return report;
}

/** Audit actual esbuild output inputs, including code hoisted into shared chunks. */
export function checkBundleGraph(metafile,{entryPoints}={}) {
  const outputs = metafile.outputs || {}; const violations = [];
  const inputsOf = name => Object.keys(outputs[name]?.inputs || {});
  for (const [name] of Object.entries(outputs)) {
    const modes = new Set(inputsOf(name).map(modeOf).filter(Boolean));
    if (modes.size > 1) violations.push({ rule: 'bundle-mixed-modes', output: name });
  }
  for (const [name, output] of Object.entries(outputs)) {
    if (!output.entryPoint || modeOf(output.entryPoint) || !isJS(name) || (entryPoints && !entryPoints.includes(output.entryPoint))) continue;
    const pending = [name]; const seen = new Set();
    while (pending.length) {
      const file = pending.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      for (const input of inputsOf(file)) {
        if (modeOf(input)) violations.push({ rule: 'bundle-home-mode', output: name, input });
        if (/node_modules\/three\/|src\/(?:runtime|legacy)\//.test(input)) violations.push({ rule: 'bundle-home-engine', output: name, input });
      }
      for (const edge of outputs[file]?.imports || []) {
        if (edge.kind === 'dynamic-import' || edge.external) continue;
        const target = outputs[edge.path] ? edge.path : posix.normalize(posix.join(posix.dirname(file), edge.path));
        if (outputs[target]) pending.push(target);
      }
    }
  }
  return { violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await assertBoundaries();
    console.log(`Boundary check: ${report.files.length} ESM modules, ${report.imports.length} imports; ${report.legacyExcluded.length} legacy fragments explicitly excluded.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
