/*
The package-shape suite. Every assertion here guards a promise the plan made: what ships, that the builds are portable, and
that require() returns an object holding replacePlainLinks, as 1.1.16's did (plan D2), while import sees a default and the
named export.
*/
import assert from 'node:assert/strict';
import {exec} from 'node:child_process';
import {access, readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = file => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
const packageJson = JSON.parse(await read('package.json'));
const DEPENDENCIES = ['get-title-at-url', 'is-an-image-url', 'replace-string-at-position', 'tldts'];

// Exactly what `npm pack` may contain: the CLI ships without its map (`files` excludes it).
const PUBLISHED_FILES = [
  'CHANGELOG.md',
  'LICENSE',
  'README.md',
  'dist/cli.mjs',
  'dist/index.cjs',
  'dist/index.cjs.map',
  'dist/index.d.cts',
  'dist/index.d.mts',
  'dist/index.mjs',
  'dist/index.mjs.map',
  'package.json',
];

// Set from the first build (about 38 kB, most of it the two source maps) and written in the plan.
const TARBALL_BUDGET = 50_000;

test('the tarball holds exactly the built files and the docs, and stays under the size budget', async () => {
  // --ignore-scripts: prepack would rebuild dist/ while the other test files are reading it.
  const stdout = await new Promise((resolve, reject) => {
    exec('npm pack --dry-run --json --ignore-scripts', {cwd: root, encoding: 'utf8'}, (error, output) => {
      if (error) {
        reject(error);
      } else {
        resolve(output);
      }
    });
  });
  const [packed] = JSON.parse(stdout);
  assert.deepEqual(new Set(packed.files.map(file => file.path)), new Set(PUBLISHED_FILES));
  assert.ok(packed.size < TARBALL_BUDGET, `the tarball is ${packed.size} bytes`);
});

test('package.json: entry points exist, the four runtime dependencies, the Node floor', async () => {
  assert.equal(packageJson.type, 'module');
  assert.deepEqual(packageJson.exports, {
    '.': {import: './dist/index.mjs', require: './dist/index.cjs'},
    './package.json': './package.json',
  });
  assert.equal(packageJson.main, './dist/index.cjs');
  assert.equal(packageJson.module, './dist/index.mjs');
  assert.equal(packageJson.types, './dist/index.d.cts');
  assert.deepEqual(packageJson.bin, {'markdown-plain-link-replacer': './dist/cli.mjs'});
  for (const file of ['dist/index.mjs', 'dist/index.cjs', 'dist/index.d.mts', 'dist/index.d.cts', 'dist/cli.mjs']) {
    await access(new URL(`../../${file}`, import.meta.url));
  }

  // Each runtime dependency has its decision (plan D5); a new one needs another.
  assert.deepEqual(Object.keys(packageJson.dependencies).toSorted((a, b) => a.localeCompare(b)), DEPENDENCIES);
  assert.equal(packageJson.engines.node, '>=20');
  assert.equal(packageJson.sideEffects, false);
  // Trusted publishing matches this URL exactly.
  assert.equal(packageJson.repository.url, 'git+https://github.com/m4bwav/markdown-plain-link-replacer.git');
});

test('the builds use nothing Node-specific or browser-specific, so they run in Deno, Bun and workers', async () => {
  for (const file of ['dist/index.mjs', 'dist/index.cjs']) {
    const code = await read(file);
    assert.doesNotMatch(code, /\bnode:/u, `${file} imports a node: module`);
    const required = Array.from(code.matchAll(/\brequire\("(?<name>[^"]+)"\)/gu), match => match.groups.name).toSorted((a, b) => a.localeCompare(b));
    assert.deepEqual(required, file.endsWith('.cjs') ? DEPENDENCIES : [], `${file} requires only the dependencies`);
    assert.doesNotMatch(code, /\bprocess\./u, `${file} uses process`);
    assert.doesNotMatch(code, /\bBuffer\b/u, `${file} uses Buffer`);
    assert.doesNotMatch(code, /\b__(?:dirname|filename)\b/u, `${file} uses __dirname or __filename`);
    assert.doesNotMatch(code, /\b(?:window|document)\b/u, `${file} uses a browser global`);
  }
});

test('the CommonJS build runs in a bare ECMAScript context given only its dependencies and the timers', async () => {
  const requested = [];
  const fakeFetch = async url => {
    requested.push(String(url));
    return new Response('<title>Hello</title>', {status: 200, headers: {'content-type': 'text/html'}});
  };

  // The dependencies load in this realm and fetch there; the package's own code runs in the bare one.
  const load = createRequire(import.meta.url);
  const original = fetch;
  globalThis.fetch = fakeFetch;
  try {
    const context = vm.createContext({
      module: {exports: {}},
      require(name) {
        assert.ok(DEPENDENCIES.includes(name), `the build requires ${name}`);
        return load(name);
      },
      setTimeout,
      clearTimeout,
      queueMicrotask,
    });
    context.exports = context.module.exports;
    vm.runInContext(await read('dist/index.cjs'), context);
    const library = context.module.exports;
    assert.equal(typeof library.replacePlainLinks, 'function');
    assert.equal(library.default.replacePlainLinks, library.replacePlainLinks);
    assert.equal(await library.replacePlainLinks('see https://example.com/a'), 'see "[Hello](https://example.com/a)", *example.com*');
    assert.deepEqual(requested, ['https://example.com/a', 'https://example.com/a']);
    assert.equal(await new Promise(resolve => {
      library.replacePlainLinks('no links', resolve);
    }), 'no links');
  } finally {
    globalThis.fetch = original;
  }
});

test('the declaration files need no Node types', async () => {
  for (const file of ['dist/index.d.mts', 'dist/index.d.cts']) {
    const types = await read(file);
    assert.doesNotMatch(types, /\bNodeJS\.|\bBuffer\b|node:|reference types=/u, file);
    assert.doesNotMatch(types, /sourceMappingURL/u, `${file} points at a declaration map that is not published`);
  }
});

test('the declaration files describe both call forms and the exports', async () => {
  const [esm, cjs] = await Promise.all([read('dist/index.d.mts'), read('dist/index.d.cts')]);
  for (const types of [esm, cjs]) {
    const callbackForm = 'declare function replacePlainLinks(markdown: string, callback: ReplacePlainLinksCallback, '
      + 'template?: string | null, options?: Omit<ReplacePlainLinksOptions, \'template\'>): void;';
    assert.ok(types.includes(callbackForm), types);
    assert.ok(types.includes('declare function replacePlainLinks(markdown: string, options?: ReplacePlainLinksOptions): Promise<string>;'), types);
    assert.match(types, /markdownPlainLinkReplacer as default/u);
  }
});
