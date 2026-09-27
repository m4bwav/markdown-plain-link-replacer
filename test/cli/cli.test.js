/*
The command line tool, run as a child process from dist/cli.mjs with fetch pointed at the local fixture server
(test/helpers/cli-preload.mjs). Every run test/golden/1.1.16.json recorded from the published bin must print the same, except
the named exceptions below; then the additions: stdin (plan A1), --timeout, and the error paths (plan E14).
*/
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {after, before, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {version} from '../helpers/builds.js';

const load = createRequire(import.meta.url);
const fixtures = load('../golden/fixture-server.cjs');
const golden = load('../golden/1.1.16.json');
const cli = fileURLToPath(new URL('../../dist/cli.mjs', import.meta.url));
// --import takes a URL: a Windows path's drive letter would read as a scheme.
const preload = new URL('../helpers/cli-preload.mjs', import.meta.url).href;

let server;
let directory;

before(async () => {
  server = await fixtures.start();
  // The capture ran the bin in a folder holding this file.
  directory = await mkdtemp(path.join(tmpdir(), 'mplr-cli-'));
  await writeFile(path.join(directory, 'cli-input.md'), 'From a file: http://www.example.com/page\n');
});

after(async () => {
  await server.close();
  await rm(directory, {recursive: true, force: true});
});

// Runs the bin with `input` on stdin (closed at once when there is none, as a pipe with nothing in it).
function run(arguments_, input = '') {
  const seen = server.requests.length;
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--import', preload, cli, ...arguments_], {cwd: directory, env: {...process.env, FIXTURE_BASE: server.base}});
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', data => {
      stdout += data;
    });
    child.stderr.on('data', data => {
      stderr += data;
    });
    child.on('close', code => {
      const requests = server.requests.slice(seen).map(request => request.url);
      resolve({
        code, stdout: stdout.replaceAll('\r\n', '\n'), stderr: stderr.replaceAll('\r\n', '\n'), requests,
      });
    });
    child.stdin.end(input);
  });
}

const P2 = '"[Page /page](http://www.example.com/page)", *example.com*';
const USAGE = /Usage\n {4}\$ markdown-plain-link-replacer/u;

// Each: what 2.0.0 prints instead, with its plan item.
const EXCEPTIONS = {
  // A1: with no argument the markdown comes from stdin; an empty stdin prints an empty line (1.1.16 printed "undefined").
  'no arguments': {code: 0, stdout: '\n', stderr: ''},
  // E14: 2.0.0's own help, for -h too (1.1.16 printed nothing for -h).
  '--help': {code: 0, stdout: USAGE, stderr: ''},
  '-h': {code: 0, stdout: USAGE, stderr: ''},
  // E1: the title get-title-at-url 3 reads.
  'one link': {code: 0, stdout: `Source: ${P2}\n`, stderr: ''},
  'the README example': {code: 0, stdout: '  "[Page /wiki/Bespin](http://starwars.wikia.com/wiki/Bespin)", *wikia.com*  \n', stderr: ''},
  '-t template': {code: 0, stdout: '[Page /page](http://www.example.com/page) from example.com\n', stderr: ''},
  '-i file': {code: 0, stdout: `From a file: ${P2}\n\n`, stderr: ''},
  '-i file and -t template (the README example shape)': {code: 0, stdout: 'From a file: [Page /page](http://www.example.com/page) from example.com\n\n', stderr: ''},
  'two arguments (the first is used)': {code: 0, stdout: '"[Page /one](http://www.example.com/one)", *example.com*\n', stderr: ''},
  // E14: errors go to stderr with exit 1 (1.1.16 printed "undefined" with exit 0, or a stack trace).
  '-i missing file': {
    code: 1, stdout: '', stderr: 'error: cannot read no-such-file.md: ENOENT\n', requests: [],
  },
  '-i without a value': {
    code: 1, stdout: '', stderr: /^error: Option '-i, --input <value>' argument missing/u, requests: [],
  },
  'an unknown flag': {
    code: 1, stdout: '', stderr: /^error: Unknown option '--foo'/u, requests: [],
  },
  // E3: a www link without a scheme is left, with no crash.
  'www link without a scheme (crashes)': {code: 0, stdout: 'www.example.com/page\n', stderr: ''},
  // E2: an IP host is replaced, its source the address.
  'IPv4 host (crashes)': {code: 0, stdout: '"[Page /page](http://192.0.2.10/page)", *192.0.2.10*\n', stderr: ''},
};

const matches = (actual, expected) => (expected instanceof RegExp ? expected.test(actual) : actual === expected);

for (const record of golden.cli) {
  test(`golden: ${record.name}`, async () => {
    const got = await run(record.args);
    const expected = EXCEPTIONS[record.name] ?? {code: record.status, stdout: record.stdout, stderr: record.stderrError};
    if (record.name === '--version') {
      expected.stdout = `${version}\n`;
    }

    assert.equal(got.code, expected.code, got.stderr);
    assert.ok(matches(got.stdout, expected.stdout), `stdout ${JSON.stringify(got.stdout)}`);
    assert.ok(matches(got.stderr, expected.stderr), `stderr ${JSON.stringify(got.stderr)}`);
    if (expected.requests) {
      assert.deepEqual(got.requests, expected.requests);
    }
  });
}

test('every CLI exception names a recorded run', () => {
  const names = new Set(golden.cli.map(record => record.name));
  for (const name of Object.keys(EXCEPTIONS)) {
    assert.ok(names.has(name), name);
  }
});

test('stdin: no argument, or "-" as the argument or the -i file (A1)', async () => {
  const input = 'piped http://www.example.com/page\nsecond line\n';
  const expected = `piped ${P2}\nsecond line\n\n`;
  for (const arguments_ of [[], ['-'], ['-i', '-']]) {
    const got = await run(arguments_, input);
    assert.equal(got.code, 0, got.stderr);
    assert.equal(got.stdout, expected, JSON.stringify(arguments_));
  }
});

test('stdin keeps UTF-8 across chunk boundaries', async () => {
  const input = `${'é'.repeat(100_000)} http://www.example.com/page`;
  const got = await run([], input);
  assert.equal(got.stdout, `${'é'.repeat(100_000)} ${P2}\n`);
});

test('--timeout: a page that never answers is left after it', async () => {
  const started = performance.now();
  const got = await run(['--timeout', '300', 'http://www.example.com/never']);
  assert.equal(got.code, 0);
  assert.equal(got.stdout, 'http://www.example.com/never\n');
  assert.ok(performance.now() - started < 5000);
});

test('--timeout must be a positive number', async () => {
  for (const value of ['0', '-1', 'abc', '']) {
    // The = form: parseArgs reads a separate "-1" as an option of its own.
    const got = await run([`--timeout=${value}`, 'x']);
    assert.equal(got.code, 1);
    assert.match(got.stderr, /--timeout takes a positive number/u);
  }
});

test('a template the renderer refuses: the error on stderr, exit 1, no request', async () => {
  const got = await run(['-t', '{{#title}}', 'http://www.example.com/page']);
  assert.equal(got.code, 1);
  assert.match(got.stderr, /^TypeError: template: the section \{\{#title\}\} is not closed/u);
  assert.deepEqual(got.requests, []);
});

test('--version and -v print the package version', async () => {
  for (const flag of ['--version', '-v']) {
    const got = await run([flag]);
    assert.equal(got.stdout, `${version}\n`);
  }
});
