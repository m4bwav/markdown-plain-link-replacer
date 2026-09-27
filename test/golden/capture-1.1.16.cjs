'use strict';
// Golden capture of the PUBLISHED markdown-plain-link-replacer 1.1.16 (package-modernize Phase 0), adapted from the skill's
// scripts/golden-capture-npm.template.cjs and stack-exchange-markdown-retriever's fixed-host capture, for an asynchronous,
// callback-style function that looks up every link in a markdown text over HTTP and HTTPS.
//
// Run in a scratch project, never inside the repository, before any code change:
//   npm init -y && npm install markdown-plain-link-replacer@1.1.16
//   (codec.cjs, fixture-server.cjs, wikialistsample.md and hogansample.md next to this file; openssl on PATH, or its path
//   in OPENSSL)
//   node capture-1.1.16.cjs > 1.1.16.json
//
// 1.1.16 looks links up through request 2.88 (get-title-at-url 1.1.8 for the title, is-an-image-url 1.0.4 for the image
// check), and request honours HTTP_PROXY and HTTPS_PROXY. The script points both at fixture-server.cjs, which records every
// request and answers it itself: http:// links arrive as absolute URLs, https:// links as a CONNECT that the server
// answers over TLS with a throwaway self-signed certificate made here by openssl (so NODE_TLS_REJECT_UNAUTHORIZED=0, for
// this process and the CLI children only). The proxy never forwards; the script stops if a case that should have made a
// request made none (it would have gone somewhere else).
//
// For each case the file records what the call returned or threw, every callback invocation (its arguments, and whether
// it ran before the call returned), any uncaught exception or unhandled rejection, and every request the fixture server
// received (how it arrived, method and URL).

const {spawn, spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {encode, decode} = require('./codec.cjs');
const fixtures = require('./fixture-server.cjs');

const net = require('node:net');

// The guard that keeps every case off the internet: a socket may connect only to the fixture server on 127.0.0.1. (The
// proxy settings send every request there; this makes a request that ignored them fail instead of leaving the machine.)
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = typeof args[0] === 'object' && args[0] !== null ? args[0] : {port: args[0], host: args[1]};
  if (!options.path && !['127.0.0.1', 'localhost', undefined].includes(options.host)) {
    throw new Error(`capture guard: refused a connection to ${options.host}:${options.port}`);
  }

  return Reflect.apply(connect, this, args);
};

// Cases that made no request although they were not marked as making none; listed on stderr at the end for review.
const noRequest = [];

const SETTLE_MS = 400;
const MAX_WAIT_MS = 10_000;

function makeCertificate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mplr-capture-'));
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  const result = spawnSync(process.env.OPENSSL || 'openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2',
    '-subj', '/CN=fixture.invalid', '-addext', 'subjectAltName=DNS:fixture.invalid',
  ], {encoding: 'utf8'});
  if (result.status !== 0) {
    throw new Error(`openssl failed: ${result.stderr || result.error}`);
  }

  const tls = {key: fs.readFileSync(key), cert: fs.readFileSync(cert)};
  fs.rmSync(dir, {recursive: true, force: true});
  return tls;
}

let server;
let current;

const describeError = error => (error instanceof Error ? {$throws: error.message, $error: error.name, code: error.code} : {$thrown: encode(error)});

process.on('uncaughtException', error => {
  if (current) {
    current.uncaught.push(describeError(error));
  } else {
    throw error;
  }
});

process.on('unhandledRejection', reason => {
  if (current) {
    current.unhandledRejections.push(describeError(reason));
  }
});

const sleep = ms => new Promise(resolve => {
  setTimeout(resolve, ms);
});

const linkReplacer = require('markdown-plain-link-replacer');
const packageVersion = require('markdown-plain-link-replacer/package.json').version;

function summarise(value) {
  return typeof value === 'string' && value.length > 3000 ? {$long: value.length, start: value.slice(0, 120), end: value.slice(-120)} : value;
}

async function runCase(name, args, options = {}) {
  const encoded = encode(args);
  const record = {name, args: encoded, returned: undefined, threw: undefined, calls: [], uncaught: [], unhandledRejections: [], requests: []};
  current = record;
  const before = server.requests.length;
  let returnedYet = false;
  let recording = true;
  const callback = (...callbackArgs) => {
    if (recording) {
      record.calls.push({sync: !returnedYet, args: callbackArgs.map(value => summarise(encode(value)))});
    }
  };

  const throwing = (...callbackArgs) => {
    callback(...callbackArgs);
    throw new Error('thrown by the callback');
  };

  const realArgs = decode(encoded).map(value => {
    if (value && typeof value === 'object' && value.$callback === true) {
      return callback;
    }

    return value && typeof value === 'object' && value.$callback === 'throws' ? throwing : value;
  });
  const started = Date.now();
  try {
    record.returned = encode(linkReplacer.replacePlainLinks(...realArgs));
  } catch (error) {
    record.threw = describeError(error);
  }

  returnedYet = true;
  const maxWait = options.maxWait ?? MAX_WAIT_MS;
  while (record.calls.length === 0 && record.uncaught.length === 0 && record.unhandledRejections.length === 0 && !record.threw && Date.now() - started < maxWait) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(10);
  }

  await sleep(options.settle ?? SETTLE_MS);
  record.requests = server.requests.slice(before).map(request => `${request.via} ${request.method} ${request.url}`);
  // Closed before the connections are dropped: a hung request would otherwise call back with the capture's own hang-up.
  recording = false;
  if (record.returned && record.returned.$undefined) {
    delete record.returned;
  }

  for (const key of ['threw']) {
    if (!record[key]) {
      delete record[key];
    }
  }

  for (const key of ['uncaught', 'unhandledRejections']) {
    if (record[key].length === 0) {
      delete record[key];
    }
  }

  current = undefined;
  server.dropConnections();
  await sleep(60);
  if (record.requests.length === 0 && options.expectRequest !== false) {
    noRequest.push(name);
  }

  return record;
}

const cb = {$callback: true};
const md = (text, extra = []) => [text, cb, ...extra];
const none = {expectRequest: false};
const fixture = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

// [name, args, options]
const methodCases = [
  // Arguments.
  ['no arguments', [], none],
  ['markdown undefined', md(undefined), none],
  ['markdown null', md(null), none],
  ['markdown empty string', md(''), none],
  ['markdown 0', md(0), none],
  ['markdown false', md(false), none],
  ['markdown NaN', md(Number.NaN), none],
  ['markdown a number', md(42), none],
  ['markdown true', md(true), none],
  ['markdown an object', md({}), none],
  ['markdown an array of a link', md(['http://www.example.com/page']), none],
  ['markdown a String wrapper', md(new String('http://www.example.com/page'))],
  ['no callback, no links', ['plain text'], none],
  ['no callback, a link', ['http://www.example.com/page']],
  ['callback a string', ['http://www.example.com/page', 'not a function']],
  ['callback that throws', ['http://www.example.com/page', {$callback: 'throws'}]],
  ['callback that throws, no links', ['plain text', {$callback: 'throws'}], none],
  // Text without links.
  ['plain text', md('Just some words.'), none],
  ['whitespace only', md('   \n  '), none],
  ['markdown link text only', md('[a label](#anchor)'), none],
  // One link.
  ['http link alone (the README example shape)', md('http://www.example.com/page')],
  ['https link alone', md('https://www.example.com/page')],
  ['link inside a sentence', md('Source: http://www.example.com/page is here.')],
  ['link with surrounding spaces (the README example)', md('  http://starwars.wikia.com/wiki/Bespin  ')],
  ['link at the start of a line after text lines', md('Line one\nhttp://www.example.com/page\nLine three')],
  ['link with CRLF line endings', md('Line one\r\nhttp://www.example.com/page\r\nLine three\r\n')],
  ['link followed by a period', md('See http://www.example.com/page.')],
  ['link followed by three periods', md('See http://www.example.com/page...')],
  ['link followed by a comma', md('See http://www.example.com/page, then more.')],
  ['link followed by a semicolon', md('See http://www.example.com/page; then more.')],
  ['link followed by a question mark', md('Have you seen http://www.example.com/page?')],
  ['link followed by an exclamation mark', md('Look: http://www.example.com/page!')],
  ['link in parentheses', md('(http://www.example.com/page)')],
  ['link in parentheses with text', md('More (see http://www.example.com/page) here.')],
  ['link in square brackets', md('[http://www.example.com/page]')],
  ['link in angle brackets (autolink)', md('<http://www.example.com/page>')],
  ['link in double quotes', md('"http://www.example.com/page"')],
  ['link in single quotes', md('\'http://www.example.com/page\'')],
  ['link in backticks (code span)', md('`http://www.example.com/page`')],
  ['link in a fenced code block', md('```\nhttp://www.example.com/page\n```')],
  ['link in an indented code block', md('Text\n\n    http://www.example.com/page\n')],
  ['link in an HTML attribute', md('<a href="http://www.example.com/page">x</a>')],
  ['link with a trailing slash', md('http://www.example.com/page/')],
  ['bare host', md('http://www.example.com')],
  ['bare host with a slash', md('http://www.example.com/')],
  ['link with a query string', md('http://www.example.com/page?a=1&b=2')],
  ['link with a fragment', md('http://www.example.com/page#section')],
  ['link with a port', md('http://www.example.com:8080/page')],
  ['link with user info', md('http://user:pass@www.example.com/page')],
  ['upper-case scheme and host', md('HTTP://WWW.EXAMPLE.COM/Page')],
  ['protocol-relative link', md('See //www.example.com/page here'), none],
  ['www link without a scheme', md('See www.example.com/page here'), none],
  ['ftp link', md('ftp://www.example.com/file'), none],
  ['mailto link', md('mailto:someone@example.com'), none],
  ['link with parentheses in the path (Wikipedia)', md('https://en.wikipedia.org/wiki/Bent_(band)')],
  ['link with encoded parentheses (the old test)', md('https://en.wikipedia.org/wiki/Bent_%28band%29')],
  ['link with parentheses in the path, in parentheses', md('(https://en.wikipedia.org/wiki/Bent_(band))')],
  ['link with a percent-encoded space', md('http://www.example.com/a%20b')],
  ['link with a non-ASCII path', md('http://www.example.com/café')],
  ['link with a non-ASCII host', md('http://café.example.com/page')],
  ['punycode host', md('http://xn--caf-dma.example.com/page')],
  ['link with an emoji in the path', md('http://www.example.com/😀')],
  // Hosts and the source name (parse-domain 0.2.1).
  ['host without www', md('http://example.org/page')],
  ['subdomain', md('http://a.b.example.com/page')],
  ['co.uk host', md('http://www.example.co.uk/page')],
  ['github.io host', md('https://someone.github.io/page')],
  ['IPv4 host', md('http://192.0.2.10/page')],
  ['localhost', md('http://localhost/page')],
  ['single-label host', md('http://intranet/page'), none],
  ['unknown TLD', md('http://www.example.notatld/page')],
  // Already linked or referenced.
  ['already a markdown link', md('[label](http://www.example.com/page)')],
  ['already a markdown link with a title', md('[label](http://www.example.com/page "title")')],
  ['already an image', md('![alt](http://www.example.com/page)')],
  ['reference definition', md('[1]: http://www.example.com/page')],
  ['reference definition with two spaces', md('[1]:  http://www.example.com/page')],
  ['reference definition without a space', md('[1]:http://www.example.com/page')],
  ['reference definition at the start of the text (position 3 check)', md('[1]: http://www.example.com/page\nhttp://www.example.com/page')],
  ['the default output fed back in', md('"[Page /page](http://www.example.com/page)", *example.com*')],
  ['the same link plain and linked', md('http://www.example.com/page and [x](http://www.example.com/page)')],
  ['the same link linked then plain', md('[x](http://www.example.com/page) and http://www.example.com/page')],
  // Several links.
  ['the same link twice', md('http://www.example.com/page and http://www.example.com/page')],
  ['the same link three times', md('http://www.example.com/page http://www.example.com/page http://www.example.com/page')],
  ['two different links', md('http://www.example.com/one and http://www.example.com/two')],
  ['a link and its longer form', md('http://www.example.com/page and http://www.example.com/page/sub')],
  ['a longer link then its shorter form', md('http://www.example.com/page/sub and http://www.example.com/page')],
  ['a link that is a prefix of another, joined', md('http://www.example.com/pagex http://www.example.com/page')],
  ['a link and the same link with a period', md('http://www.example.com/page. And http://www.example.com/page')],
  ['http and https of the same page', md('http://www.example.com/page https://www.example.com/page')],
  ['five links', md('http://www.example.com/1 http://www.example.com/2 http://www.example.com/3 http://www.example.com/4 http://www.example.com/5')],
  ['a link and an image link by extension', md('http://www.example.com/page http://www.example.com/pic.png')],
  // Images.
  ['image by extension', md('http://www.example.com/pic.png'), none],
  ['image by extension, upper case', md('http://www.example.com/pic.JPG'), none],
  ['image by extension with a query', md('http://www.example.com/pic.png?w=2'), none],
  ['image by content type', md('http://www.example.com/img')],
  ['image content type in upper case', md('http://www.example.com/img-upper')],
  ['svg by content type', md('http://www.example.com/img-svg')],
  ['redirect to an image', md('http://www.example.com/redirect-image')],
  // Pages and titles.
  ['404', md('http://www.example.com/404')],
  ['500', md('http://www.example.com/500')],
  ['410', md('http://www.example.com/410')],
  ['redirect', md('http://www.example.com/redirect')],
  ['redirect loop', md('http://www.example.com/loop')],
  ['no title', md('http://www.example.com/notitle')],
  ['empty title', md('http://www.example.com/empty-title')],
  ['title of spaces', md('http://www.example.com/space-title')],
  ['title with HTML entities', md('http://www.example.com/entities')],
  ['title with markdown characters', md('http://www.example.com/brackets')],
  ['title with dollar patterns', md('http://www.example.com/dollar')],
  ['title with a pipe', md('http://www.example.com/pipe')],
  ['title with a dash', md('http://www.example.com/dash')],
  ['title with a colon', md('http://www.example.com/colon')],
  ['article heading beside the title', md('http://www.example.com/heading')],
  ['title with non-ASCII and an emoji', md('http://www.example.com/unicode')],
  ['latin-1 page', md('http://www.example.com/latin1')],
  ['300-character title', md('http://www.example.com/long')],
  ['title with line breaks', md('http://www.example.com/newline')],
  ['title with mustache tags', md('http://www.example.com/mustache')],
  ['title that contains a link', md('http://www.example.com/contains-url')],
  ['text/plain page', md('http://www.example.com/plain')],
  ['JSON page', md('http://www.example.com/json')],
  ['page without a content type', md('http://www.example.com/no-content-type')],
  ['gzip page', md('http://www.example.com/gzip')],
  ['2 MB page', md('http://www.example.com/big')],
  ['two title elements', md('http://www.example.com/two-titles')],
  ['title only inside svg', md('http://www.example.com/svg-title')],
  // The whole text is HTML-decoded first.
  ['entities in the text, no links', md('Tom &amp; Jerry &lt;3 &copy; &#169; &nbsp;.'), none],
  ['entities in the text, with a link', md('A &amp; B http://www.example.com/page')],
  ['an encoded ampersand in a link', md('http://www.example.com/page?a=1&amp;b=2')],
  // Templates (hogan.js).
  ['template: the README example', md('http://www.example.com/page', ['[{{title}}]({{url}}) from {{source}}'])],
  ['template: empty string (default)', md('http://www.example.com/page', [''])],
  ['template: undefined (default)', md('http://www.example.com/page', [undefined])],
  ['template: null (default)', md('http://www.example.com/page', [null])],
  ['template: no tags', md('http://www.example.com/page', ['fixed text'])],
  ['template: title only', md('http://www.example.com/page', ['{{title}}'])],
  ['template: url only', md('http://www.example.com/page', ['{{url}}'])],
  ['template: url twice', md('http://www.example.com/page', ['{{url}} {{url}}'])],
  ['template: url in link form', md('http://www.example.com/page', ['[{{url}}]({{url}})'])],
  ['template: triple braces', md('http://www.example.com/entities', ['[{{{title}}}]({{{url}}})'])],
  ['template: escaped title', md('http://www.example.com/entities', ['[{{title}}]({{url}})'])],
  ['template: unknown tag', md('http://www.example.com/page', ['{{nope}}|{{title}}'])],
  ['template: a section', md('http://www.example.com/page', ['{{#title}}yes{{/title}}'])],
  ['template: unclosed tag', md('http://www.example.com/page', ['{{title'])],
  ['template: unclosed section', md('http://www.example.com/page', ['{{#title}}x'])],
  ['template: a number', md('http://www.example.com/page', [42])],
  ['template: an object', md('http://www.example.com/page', [{}])],
  ['template with dollar signs', md('http://www.example.com/page', ['$& {{title}} $1'])],
  ['template with a link in an https page', md('https://www.example.com/page', ['<{{url}}>'])],
  ['template, no links in the text', md('plain', ['{{title}}']), none],
  // Hosts the old code cannot name.
  ['IPv4 host with a 404', md('http://192.0.2.10/404')],
  // The repository's own fixtures.
  ['test/fixtures/wikialistsample.md', md(fixture('wikialistsample.md')), {maxWait: 20_000}],
  ['test/fixtures/hogansample.md', md(fixture('hogansample.md'))],
  ['test/fixtures/hogansample.md with the README template', md(fixture('hogansample.md'), ['[{{title}}]({{url}}) from {{source}}'])],
  // Size.
  ['a 200 000-character text with one link', md(`${'word '.repeat(40_000)}http://www.example.com/page`)],
  // The connection: is-an-image-url waits 20 s, then get-title-at-url waits forever.
  ['server never answers (no callback within 25 s)', md('http://www.example.com/never'), {maxWait: 25_000, settle: 0}],
];

function cliRecord(name, args, status, stdout, stderr) {
  const text = value => String(value).replaceAll('\r\n', '\n');
  const errorLine = text(stderr).split('\n').find(line => /^\w*Error\b/.test(line) || /^error:/i.test(line));
  const stderrLines = text(stderr).split('\n').filter(line => line && !line.includes('NODE_TLS_REJECT_UNAUTHORIZED') && !line.includes('--trace-warnings'));
  return {name, args, status, stdout: summarise(text(stdout)), stderrError: errorLine ?? (stderrLines.length === 0 ? '' : '(stderr without an error line)')};
}

function runCliAsync(name, args) {
  const cli = path.join(path.dirname(require.resolve('markdown-plain-link-replacer/package.json')), 'cli.js');
  const before = server.requests.length;
  return new Promise(resolve => {
    const child = spawn(process.execPath, [cli, ...args], {env: {...process.env}, cwd: __dirname});
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), 15_000);
    child.stdout.on('data', data => {
      stdout += data;
    });
    child.stderr.on('data', data => {
      stderr += data;
    });
    child.on('close', status => {
      clearTimeout(timer);
      const record = cliRecord(name, args, status, stdout, stderr);
      record.requests = server.requests.slice(before).map(request => `${request.via} ${request.method} ${request.url}`);
      resolve(record);
    });
  });
}

async function main() {
  const tls = makeCertificate();
  server = await fixtures.start({tls});
  for (const name of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy']) {
    process.env[name] = server.proxy;
  }

  delete process.env.NO_PROXY;
  delete process.env.no_proxy;
  delete process.env.DEBUG;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  process.removeAllListeners('warning');
  fs.writeFileSync(path.join(__dirname, 'cli-input.md'), 'From a file: http://www.example.com/page\n');

  const cases = [];
  for (const [name, args, options] of methodCases) {
    // eslint-disable-next-line no-await-in-loop
    cases.push(await runCase(name, args, options));
  }

  const cliCases = [];
  for (const [name, args] of [
    ['no arguments', []],
    ['--help', ['--help']],
    ['-h', ['-h']],
    ['--version', ['--version']],
    ['plain text', ['no links here']],
    ['one link', ['Source: http://www.example.com/page']],
    ['the README example', ['  http://starwars.wikia.com/wiki/Bespin  ']],
    ['-t template', ['-t', '[{{title}}]({{url}}) from {{source}}', 'http://www.example.com/page']],
    ['-i file', ['-i', 'cli-input.md']],
    ['-i file and -t template (the README example shape)', ['-i', 'cli-input.md', '-t', '[{{title}}]({{url}}) from {{source}}']],
    ['-i missing file', ['-i', 'no-such-file.md']],
    ['-i without a value', ['-i']],
    ['two arguments (the first is used)', ['http://www.example.com/one', 'http://www.example.com/two']],
    ['an unknown flag', ['--foo', 'http://www.example.com/page']],
    ['an image link', ['http://www.example.com/pic.png']],
    ['a 404 link', ['http://www.example.com/404']],
    ['www link without a scheme (crashes)', ['www.example.com/page']],
    ['IPv4 host (crashes)', ['http://192.0.2.10/page']],
  ]) {
    // eslint-disable-next-line no-await-in-loop
    cliCases.push(await runCliAsync(name, args));
  }

  fs.rmSync(path.join(__dirname, 'cli-input.md'), {force: true});

  const quirks = {
    requireResultType: typeof linkReplacer,
    ownKeys: Reflect.ownKeys(linkReplacer).map(String),
    functionName: linkReplacer.replacePlainLinks.name,
    functionLength: linkReplacer.replacePlainLinks.length,
    transport: 'request 2.88.2 through HTTP_PROXY and HTTPS_PROXY (CONNECT host:443) to fixture-server.cjs; TLS verification off for the throwaway certificate',
    requestsPerLink: 'one GET by is-an-image-url (skipped when the path has an image extension), then after every link was checked, one GET by get-title-at-url, started 100 ms apart per link',
    noTimeout: 'is-an-image-url gives up after 20 s; get-title-at-url 1.1.8 has no timeout, so a page that never answers means no callback (the capture then drops the connection and ignores what follows)',
  };

  const dependency = name => require(`${name}/package.json`).version;
  const header = {
    package: `markdown-plain-link-replacer@${packageVersion}`,
    dependencies: Object.fromEntries(['get-title-at-url', 'is-an-image-url', 'replace-string-at-position', 'url-regex', 'parse-domain', 'hogan.js', 'he', 'bluebird', 'array-iterate', 'is-url', 'meow', 'request', 'article-title', 'is-image'].map(name => [name, dependency(name)])),
    node: process.version,
    captured: new Date().toISOString().slice(0, 10),
    note: 'Golden outputs of the published 1.1.16 against test/golden/fixture-server.cjs; see capture-1.1.16.cjs and codec.cjs for the format.',
    quirks,
  };
  await server.close();
  if (noRequest.length > 0) {
    console.error(`cases without a request: ${noRequest.join(' | ')}`);
  }

  const lines = cases.map(entry => JSON.stringify(entry));
  const cliLines = cliCases.map(entry => JSON.stringify(entry));
  process.stdout.write(`${JSON.stringify(header, null, '\t').slice(0, -2)},\n\t"cases": [\n\t\t${lines.join(',\n\t\t')}\n\t],\n\t"cli": [\n\t\t${cliLines.join(',\n\t\t')}\n\t]\n}\n`);
  // The hanging case's socket and request's agent can keep the loop alive.
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
