// wiki-verify for markdown-plain-link-replacer@2.0.0: runs every example on the wiki against the PUBLISHED package,
// never the working tree. The repository keeps this file as ai-docs/notes/2026-09-29-wiki-verify.mjs and its output as
// 2026-09-29-wiki-verify.out.txt, so the next release can run it again and diff (wikiwright.py diffout).
//
// Run it from a scratch folder outside the repository:
//   npm init -y
//   npm install markdown-plain-link-replacer@2.0.0 undici@7 typescript@6 @types/node@24
//   node wiki-verify.mjs > out.txt
// openssl must be on PATH (Git for Windows has one), or named by OPENSSL.
//
// Optional environment, each adding a section:
//   RT=<folder with the npm packages deno and bun>   the Home example in Deno and Bun
//   PM=1          installs 2.0.0 with pnpm, yarn 1, yarn 4 and bun (with RT) under ./pm and runs the Home example
//   V1116=<folder with markdown-plain-link-replacer@1.1.16 installed>   the old version, for Versions and upgrading
//   GOLDEN=<the clone's test/golden> (with V1116)     replays capture-1.1.16.cjs against 1.1.16 today and against 2.0.0
//   SAMPLES=<the clone's test/fixtures>               the repository's sample files, for Recipes
//   BASH=<bash executable>                            the shell loop recipe (Git Bash on Windows)
//   OLDEST_NODE=20   reruns the whole script under Node 20 (the oldest line in engines) and saves that run's output
//                    as wiki-verify.node20.out.txt; diff it with this run's (wikiwright.py diffout)
//
// How the lookups stay local. The package asks get-title-at-url and is-an-image-url for each link, and they fetch the
// real host names. Every request goes to a stand-in proxy on 127.0.0.1, which answers CONNECT (Node tunnels http: too,
// wikiwright L-112) by handing the socket to the fixture's plain server (port 80) or TLS server (port 443). The TLS server
// has a throwaway certificate for the host names below, made here by openssl and trusted through NODE_EXTRA_CA_CERTS.
// Child processes on a Node with NODE_USE_ENV_PROXY support get it with HTTP_PROXY and HTTPS_PROXY; on a Node without it
// (20) they load route.cjs, which installs undici's EnvHttpProxyAgent. This process routes its own fetch through undici's
// ProxyAgent. A socket guard (guard.cjs, preloaded everywhere through NODE_OPTIONS) refuses any connection that is not to
// 127.0.0.1, so a request that skipped the proxy fails instead of reaching the internet.
//
// Every case prints "## <label>" and then exactly what the code on the page prints. Pages show the real host names; the
// titles are the fixture's, listed in PAGES below.

import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import zlib from 'node:zlib';
import {spawn, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import {setTimeout as sleep} from 'node:timers/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Everything runs in this file's folder, so no shell needs to change directory first.
process.chdir(path.dirname(fileURLToPath(import.meta.url)));

const PACKAGE = 'markdown-plain-link-replacer';
const VERSION = '2.0.0';
const require = createRequire(import.meta.url);
const here = process.cwd();
const {RT, PM, V1116, GOLDEN, SAMPLES, BASH} = process.env;
const isWindows = process.platform === 'win32';

function show(label, value) {
	console.log(`## ${label}`);
	console.log(typeof value === 'string' ? value : util.inspect(value));
	console.log();
}

// Runs a page's example in this process and prints what its console.log calls printed.
async function example(label, fn) {
	const lines = [];
	const original = console.log;
	console.log = (...args) => lines.push(util.format(...args));
	try {
		await fn();
	} catch (error) {
		lines.push(`Uncaught ${error?.name}: ${error?.message}`);
	} finally {
		console.log = original;
	}

	show(label, lines.join('\n'));
}

// How a call ends: resolved value, rejection or synchronous throw.
async function outcome(fn) {
	let promise;
	try {
		promise = fn();
	} catch (error) {
		return `throws ${error.name}: ${error.message}`;
	}

	if (!(promise instanceof Promise)) {
		return `returns ${util.inspect(promise)}`;
	}

	try {
		return `resolves ${util.inspect(await promise)}`;
	} catch (error) {
		return `rejects ${error?.name ?? typeof error}: ${error?.message ?? util.inspect(error)}`;
	}
}

// ----- the throwaway certificate and the fixture pages -----
const HOSTS = ['en.wikipedia.org', 'example.com', '*.example.com', 'www.example.co.uk', 'someone.github.io', 'starwars.wikia.com', 'www.crazymonkeygames.com'];
// A throwaway certificate authority (tls/ca.pem, the file every runtime is told to trust) and a server certificate it
// signed for HOSTS. Deno's TLS refuses a self-signed certificate marked as a CA as the server's own, so the two are separate.
rmSync('tls', {recursive: true, force: true});
mkdirSync('tls', {recursive: true});
for (const args of [
	['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'tls/ca-key.pem', '-out', 'tls/ca.pem', '-days', '2', '-subj', '/CN=wiki-verify CA',
		'-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign'],
	['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'tls/key.pem', '-out', 'tls/server.csr', '-subj', '/CN=wiki-verify fixture',
		'-addext', `subjectAltName=${HOSTS.map(host => `DNS:${host}`).join(',')}`],
	['x509', '-req', '-in', 'tls/server.csr', '-CA', 'tls/ca.pem', '-CAkey', 'tls/ca-key.pem', '-set_serial', '1', '-days', '2', '-copy_extensions', 'copyall', '-out', 'tls/cert.pem'],
]) {
	const made = spawnSync(process.env.OPENSSL || 'openssl', args, {encoding: 'utf8', env: {...process.env, MSYS_NO_PATHCONV: '1'}});
	if (made.status !== 0) {
		throw new Error(`openssl failed: ${made.stderr || made.error}`);
	}
}

const certificate = readFileSync('tls/ca.pem', 'utf8');
const CA_FILE = path.resolve('tls/ca.pem');
const html = title => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><p>Body.</p></body></html>`;
const HTML = {'content-type': 'text/html; charset=utf-8'};
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
// host + path -> title: the pages the wiki's examples link to. The sample files' titles are the ones their recorded
// outputs (test/fixtures/*-output.md) show.
const PAGES = {
	'en.wikipedia.org/wiki/Bespin': 'Bespin - Wikipedia',
	'starwars.wikia.com/wiki/Bespin': 'Bespin | Wookieepedia | Fandom',
	'example.com/': 'Example Domain',
	'www.crazymonkeygames.com/Pandemic-2.html': 'Pandemic 2 and Other Free Internet Games @ CrazyMonkeyGames.com',
	'starwars.wikia.com/wiki/TranLang_III_communications_module': 'TranLang III communications module',
	'docs.example.com/guide': 'Getting started - Example Docs',
	'example.com/colon': 'Release notes: version 2',
	'example.com/tricky': 'Array[0] *star* _under_ `tick` <b>',
	'example.com/amp': 'Tom &amp; Jerry',
	'example.com/mustache': '{{url}} and {{{title}}}',
	'example.com/contains-url': 'See https://example.com/other for more',
	'example.com/new': 'New Home',
	'example.com/newline': 'First line\nsecond   line',
};
// path -> [status, headers, body] for any host, or a function
const SPECIAL = {
	'/logo': [200, {'content-type': 'image/png'}, PNG],
	'/missing': [404, HTML, html('Not Found')],
	'/down': [500, HTML, html('Server Error')],
	'/plain': [200, {'content-type': 'text/plain'}, '<title>Plain Text</title>'],
	'/json': [200, {'content-type': 'application/json'}, '{"title":"json"}'],
	'/notitle': [200, HTML, '<!doctype html><html><head></head><body>No title.</body></html>'],
	'/old': [301, {location: '/new'}, ''],
	'/heading': [200, HTML, '<html><head><title>Doc Title</title></head><body><h1>The Article Heading</h1></body></html>'],
	'/latin1': [200, {'content-type': 'text/html; charset=iso-8859-1'}, Buffer.concat([Buffer.from('<title>Caf'), Buffer.from([0xE9]), Buffer.from(' au lait</title>')])],
	'/gzip': [200, {...HTML, 'content-encoding': 'gzip'}, zlib.gzipSync(html('Gzipped Title'))],
	'/never': 'never',
	'/slow': 'slow',
};
const seen = [];
const tunnels = [];
const hanging = new Set();
function serve(scheme) {
	return (request, response) => {
		const host = (request.headers.host ?? '').replace(/:\d+$/, '');
		const {pathname, searchParams} = new URL(request.url, 'http://x');
		seen.push(`${request.method} ${scheme}://${host}${request.url}`);
		const title = PAGES[`${host}${pathname}`];
		const special = SPECIAL[pathname];
		if (title !== undefined) {
			response.writeHead(200, HTML).end(html(title));
		} else if (special === 'never') {
			hanging.add(response);
		} else if (special === 'slow') {
			setTimeout(() => response.writeHead(200, HTML).end(html('Slow Page')), Number(searchParams.get('ms') ?? 1000));
		} else if (special) {
			response.writeHead(special[0], special[1]).end(special[2]);
		} else {
			response.writeHead(200, HTML).end(html(`Page ${pathname}`));
		}
	};
}

const plain = http.createServer(serve('http'));
const secure = https.createServer({key: readFileSync('tls/key.pem'), cert: readFileSync('tls/cert.pem')}, serve('https'));
const proxy = http.createServer((request, response) => {
	tunnels.push(`${request.method} ${request.url}`);
	plain.emit('request', request, response);
});
proxy.on('connect', (request, socket) => {
	tunnels.push(`CONNECT ${request.url}`);
	socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
	(request.url.endsWith(':443') ? secure : plain).emit('connection', socket);
});
await new Promise(resolve => {
	proxy.listen(0, '127.0.0.1', resolve);
});
const proxyUrl = `http://127.0.0.1:${proxy.address().port}`;
const dropHanging = () => {
	for (const response of hanging) {
		response.destroy();
	}

	hanging.clear();
};

// ----- the guard and the routes, for this process and every child -----
writeFileSync('guard.cjs', `'use strict';
// Refuses every connection that is not to 127.0.0.1, so no example can reach the internet. net.connect() (fetch's plain
// http) passes its arguments already normalised into one array, [options, callback]: read the options from inside it,
// or a plain http request slips through (it did in this script's first Node 20 run).
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
	const first = Array.isArray(args[0]) ? args[0][0] : args[0];
	const o = typeof first === 'object' && first !== null ? first : {port: first, host: args[1]};
	if (!o.path && !['127.0.0.1', 'localhost', '::1', undefined].includes(o.host)) {
		throw new Error('wiki-verify guard: refused a connection to ' + o.host + ':' + o.port);
	}
	return Reflect.apply(connect, this, args);
};
`);
writeFileSync('route.cjs', `'use strict';
// For a Node without NODE_USE_ENV_PROXY (20): fetch goes through HTTP_PROXY and HTTPS_PROXY by undici's own agent.
const {setGlobalDispatcher, EnvHttpProxyAgent} = require('undici');
setGlobalDispatcher(new EnvHttpProxyAgent());
`);
require('./guard.cjs');
const {setGlobalDispatcher, ProxyAgent} = require('undici');
setGlobalDispatcher(new ProxyAgent({uri: proxyUrl, requestTls: {ca: [...tls.rootCertificates, certificate]}}));

// NODE_OPTIONS reads a backslash as an escape, so the path goes in with forward slashes.
const preload = file => `--require "${path.resolve(file).split(path.sep).join('/')}"`;
const baseEnv = {HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl, NODE_EXTRA_CA_CERTS: CA_FILE, NO_PROXY: '', NODE_OPTIONS: preload('guard.cjs')};
// Does this Node honour NODE_USE_ENV_PROXY? (Node 24 does; Node 20 does not.)
// An .invalid host can never be reached directly, so a probe that bypassed the proxy fails instead of leaving the machine.
writeFileSync('probe.mjs', "console.log(await fetch('http://wiki-verify.invalid/').then(r => r.status, e => e.cause?.message ?? e.message));\n");
const probeRun = await run(process.execPath, ['probe.mjs'], {env: {...baseEnv, NODE_USE_ENV_PROXY: '1'}});
const envProxy = probeRun.stdout.trim() === '200';
// The environment a child needs to reach the fixture by host name.
const routed = envProxy ? {...baseEnv, NODE_USE_ENV_PROXY: '1'} : {...baseEnv, NODE_OPTIONS: `${preload('guard.cjs')} ${preload('route.cjs')}`};

// A child process, asynchronously (spawnSync would block the fixture server in this process, L-007). stdin is closed
// (empty) unless input is given: the command line reads stdin when it gets no markdown argument.
function run(file, args, {cwd = here, env = {}, shell = false, input = ''} = {}) {
	return new Promise(resolve => {
		const child = spawn(file, args, {cwd, env: {...process.env, ...env}, shell});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', chunk => {
			stdout += chunk;
		});
		child.stderr.on('data', chunk => {
			stderr += chunk;
		});
		child.on('close', code => {
			resolve({code, stdout: stdout.replaceAll('\r\n', '\n'), stderr: stderr.replaceAll('\r\n', '\n')});
		});
		child.stdin.end(input);
	});
}

const text = ({code, stdout, stderr}) => `${stdout}${stderr ? `--- stderr\n${stderr}` : ''}`.trimEnd() + (code === 0 ? '' : `\n--- exit ${code}`);
const node = (file, {env = {}, input} = {}) => run(process.execPath, [file], {env: {...routed, ...env}, input});

// ----- the installed package -----
const pkgDir = path.join(here, 'node_modules', PACKAGE);
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
if (pkg.version !== VERSION) {
	throw new Error(`installed ${pkg.version}, expected ${VERSION}`);
}

show('installed', `${PACKAGE}@${pkg.version} on Node ${process.version}`);
show('lookups reach the fixture through', envProxy ? 'NODE_USE_ENV_PROXY=1 with HTTP_PROXY and HTTPS_PROXY' : 'undici EnvHttpProxyAgent preloaded (this Node ignores NODE_USE_ENV_PROXY)');
const esm = await import(PACKAGE);
const cjs = require(PACKAGE);
const {replacePlainLinks} = esm;
show('esm exports', Object.keys(esm).sort());
show('esm default export', esm.default);
show('cjs: require() returns', cjs);
show('cjs keys', Object.keys(cjs).sort());
show('cjs .replacePlainLinks is the ES module function', cjs.replacePlainLinks === replacePlainLinks ? 'same function' : 'different functions');
show('package.json fields', {engines: pkg.engines, bin: pkg.bin, exports: pkg.exports, dependencies: pkg.dependencies});
show('installed dependencies', Object.keys(pkg.dependencies).map(name => `${name}@${require(`${name}/package.json`).version}`).join('\n'));
show('deep import of markdown-plain-link-replacer/dist/index.mjs', await import('markdown-plain-link-replacer/dist/index.mjs').then(() => 'loads', error => `rejects ${error.code}`));

// ----- Home and Getting started -----
const homeCode = `import {replacePlainLinks} from 'markdown-plain-link-replacer';

const markdown = await replacePlainLinks('Source: https://en.wikipedia.org/wiki/Bespin');
console.log(markdown);
`;
writeFileSync('home.mjs', homeCode);
writeFileSync('home-deno.mjs', homeCode.replace("from 'markdown-plain-link-replacer'", `from 'npm:markdown-plain-link-replacer@${VERSION}'`));
const callbackCode = `const linkReplacer = require('markdown-plain-link-replacer');

linkReplacer.replacePlainLinks('  http://starwars.wikia.com/wiki/Bespin  ', newMarkdown => {
  console.log(newMarkdown);
}, '[{{title}}]({{url}}) from {{source}}');
`;
writeFileSync('callback.cjs', callbackCode);
const requirePromiseCode = `const {replacePlainLinks} = require('markdown-plain-link-replacer');

replacePlainLinks('See https://docs.example.com/guide.', {template: '[{{title}}]({{url}})'})
  .then(markdown => console.log(markdown));
`;
writeFileSync('promise.cjs', requirePromiseCode);
show('home: node home.mjs', text(await node('home.mjs')));
show('home: node home.mjs, second run', text(await node('home.mjs')));
show('getting started: node callback.cjs', text(await node('callback.cjs')));
show('getting started: node promise.cjs', text(await node('promise.cjs')));
writeFileSync('untrusted.mjs', "import {replacePlainLinks} from 'markdown-plain-link-replacer';\n\nconsole.log(await replacePlainLinks('https://example.com/ and http://example.com/'));\n");
show('edge: an https page whose certificate is not trusted (no NODE_EXTRA_CA_CERTS)', text(await node('untrusted.mjs', {env: {NODE_EXTRA_CA_CERTS: ''}})));
show('home: the requests one link makes', await (async () => {
	seen.length = 0;
	await node('home.mjs');
	return seen.join('\n');
})());

if (RT) {
	const bin = name => path.join(RT, 'node_modules', '.bin', isWindows ? `${name}.cmd` : name);
	const shell = isWindows;
	const denoEnv = {HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl, DENO_CERT: CA_FILE, NO_PROXY: ''};
	show('runtimes: deno --version', (await run(bin('deno'), ['--version'], {shell})).stdout.split('\n')[0]);
	show('runtimes: deno run --allow-net home-deno.mjs', text(await run(bin('deno'), ['run', '--allow-net', 'home-deno.mjs'], {shell, env: denoEnv})));
	show('runtimes: deno run home-deno.mjs (no --allow-net, not a terminal)', text(await run(bin('deno'), ['run', 'home-deno.mjs'], {shell, env: denoEnv})).replace(/\d+(\.\d+)?m?s\b/g, '<time>'));
	show('runtimes: bun --version', (await run(bin('bun'), ['--version'], {shell})).stdout.trim());
	const bunEnv = {HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl, NODE_EXTRA_CA_CERTS: CA_FILE, NO_PROXY: ''};
	show('runtimes: bun home.mjs', text(await run(bin('bun'), ['home.mjs'], {shell, env: bunEnv})));
	show('runtimes: bun callback.cjs', text(await run(bin('bun'), ['callback.cjs'], {shell, env: bunEnv})));
}

if (PM) {
	const shell = isWindows;
	const corepack = {COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'};
	const managers = [
		['pnpm', ['corepack', ['pnpm', 'add', `${PACKAGE}@${VERSION}`]], ['node', ['home.mjs']]],
		['yarn', ['corepack', ['yarn', 'add', `${PACKAGE}@${VERSION}`]], ['corepack', ['yarn', '--silent', 'node', 'home.mjs']]],
		['yarn4', ['corepack', ['yarn', 'add', `${PACKAGE}@${VERSION}`]], ['corepack', ['yarn', 'node', 'home.mjs']]],
	];
	if (RT) {
		const bun = path.join(RT, 'node_modules', '.bin', isWindows ? 'bun.cmd' : 'bun');
		managers.push(['bun', [bun, ['add', `${PACKAGE}@${VERSION}`]], [bun, ['home.mjs']]]);
	}

	for (const [name, [installer, installArgs], [runner, runArgs]] of managers) {
		const dir = path.join(here, 'pm', name);
		rmSync(dir, {recursive: true, force: true});
		mkdirSync(dir, {recursive: true});
		// yarn4: the packageManager field makes corepack run Yarn 4 (Plug'n'Play, so the example runs through yarn node).
		writeFileSync(path.join(dir, 'package.json'), JSON.stringify({name: `try-${name}`, private: true, type: 'module', ...(name === 'yarn4' ? {packageManager: 'yarn@4.18.1'} : {})}));
		if (name.startsWith('yarn')) {
			writeFileSync(path.join(dir, 'yarn.lock'), '');
		}

		copyFileSync('home.mjs', path.join(dir, 'home.mjs'));
		// The installs go to the registry, so they run without the guard and the proxy; the example runs routed.
		const installed = await run(installer, installArgs, {cwd: dir, shell, env: {...corepack, NODE_OPTIONS: ''}});
		const version = await run(installer, installer === 'corepack' ? [name.replace('4', ''), '--version'] : ['--version'], {cwd: dir, shell, env: {...corepack, NODE_OPTIONS: ''}});
		const env = runner === 'node' || runner === 'corepack' ? {...routed, ...corepack} : {HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl, NODE_EXTRA_CA_CERTS: CA_FILE, NO_PROXY: ''};
		show(`package managers: ${name.replace('4', '')} ${version.stdout.trim()} install exit ${installed.code}, then the Home example`, text(await run(runner === 'node' ? process.execPath : runner, runArgs, {cwd: dir, shell: runner !== 'node' && shell, env})));
	}
}

// ----- Getting started: TypeScript -----
mkdirSync('types', {recursive: true});
writeFileSync('types/ok.mts', `import {replacePlainLinks, type ReplacePlainLinksOptions} from 'markdown-plain-link-replacer';

const options: ReplacePlainLinksOptions = {template: '[{{title}}]({{url}})', timeout: 5000};
const markdown: string = await replacePlainLinks('Source: https://example.com', options);

replacePlainLinks('Source: https://example.com', (newMarkdown: string) => {
  console.log(newMarkdown, markdown);
});
`);
writeFileSync('types/bad.mts', `import {replacePlainLinks} from 'markdown-plain-link-replacer';

await replacePlainLinks('Source: https://example.com', {timeout: '5s'});
`);
writeFileSync('types/nullable.mts', `import {replacePlainLinks} from 'markdown-plain-link-replacer';

declare const input: string | undefined;
const answer = await replacePlainLinks(input);
export const length: number = answer.length;
`);
writeFileSync('types/cjs.cts', `import linkReplacer = require('markdown-plain-link-replacer');

linkReplacer.replacePlainLinks('Source: https://example.com', markdown => console.log(markdown));
linkReplacer.default.replacePlainLinks('Source: https://example.com').then(console.log);
`);
const tsc = path.join(here, 'node_modules', 'typescript', 'bin', 'tsc');
const tscArgs = ['--strict', '--noEmit', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022', '--types', 'node'];
show('typescript: tsc version', (await run(process.execPath, [tsc, '--version'])).stdout.trim());
for (const file of ['ok.mts', 'bad.mts', 'nullable.mts', 'cjs.cts']) {
	// eslint-disable-next-line no-await-in-loop
	show(`typescript: ${file}`, text(await run(process.execPath, [tsc, ...tscArgs, `types/${file}`])) || 'no errors');
}

// ----- API reference -----
show('api: the Promise form returns a Promise', replacePlainLinks('plain text') instanceof Promise);
show('api: the callback form returns', util.inspect(replacePlainLinks('plain text', () => {})));
await example('api: the callback runs after the call returns', async () => {
	await new Promise(resolve => {
		replacePlainLinks('See https://example.com/', markdown => {
			console.log('callback:', markdown);
			resolve();
		});
		console.log('returned');
	});
});
await example('api: a falsy markdown, callback form (answered before the call returns)', async () => {
	for (const value of ['', null, undefined, 0, false]) {
		let returned = false;
		replacePlainLinks(value, answer => {
			console.log(util.inspect(value), '->', util.inspect(answer), returned ? 'after return' : 'before return');
		});
		returned = true;
	}
});
show('api: a falsy markdown, Promise form', (await Promise.all(['', null, undefined, 0, false, Number.NaN].map(async value => `${util.inspect(value)} -> ${await outcome(() => replacePlainLinks(value))}`))).join('\n'));
show('api: a String object', await outcome(() => replacePlainLinks(new String('See https://example.com/'))));
show('api: options', [
	`template: ${await outcome(() => replacePlainLinks('See https://example.com/.', {template: '<{{url}}> ({{title}}, {{source}})'}))}`,
	`third argument, no callback (1.x order): ${await outcome(() => replacePlainLinks('See https://example.com/.', undefined, '[{{title}}]({{url}})'))}`,
	`null options with a template third: ${await outcome(() => replacePlainLinks('See https://example.com/.', null, '[{{title}}]({{url}})'))}`,
	`options.template wins over the third argument: ${await outcome(() => replacePlainLinks('See https://example.com/.', {template: '{{title}}'}, '[{{title}}]({{url}})'))}`,
	`empty template means the default: ${await outcome(() => replacePlainLinks('See https://example.com/.', {template: ''}))}`,
].join('\n'));
await example('api: callback form with template and options', async () => {
	await new Promise(resolve => {
		replacePlainLinks('See https://example.com/slow?ms=1500 and https://example.com/', markdown => {
			console.log(markdown);
			resolve();
		}, '[{{title}}]({{url}})', {timeout: 300});
	});
});
show('api: errors', (await Promise.all([
	['replacePlainLinks(42)', () => replacePlainLinks(42)],
	["replacePlainLinks(['https://example.com'])", () => replacePlainLinks(['https://example.com'])],
	['replacePlainLinks({})', () => replacePlainLinks({})],
	["replacePlainLinks('x', 'yes')", () => replacePlainLinks('x', 'yes')],
	["replacePlainLinks('x', {template: 42})", () => replacePlainLinks('x', {template: 42})],
	["replacePlainLinks('x', {template: '{{> header}}'})", () => replacePlainLinks('x', {template: '{{> header}}'})],
	["replacePlainLinks('x', {template: '{{=<% %>=}}'})", () => replacePlainLinks('x', {template: '{{=<% %>=}}'})],
	["replacePlainLinks('x', {template: '{{title'})", () => replacePlainLinks('x', {template: '{{title'})],
	["replacePlainLinks('x', {template: '{{#title}}x'})", () => replacePlainLinks('x', {template: '{{#title}}x'})],
	["replacePlainLinks('x', {timeout: 0})", () => replacePlainLinks('x', {timeout: 0})],
	["replacePlainLinks('x', {timeout: '5000'})", () => replacePlainLinks('x', {timeout: '5000'})],
	["replacePlainLinks('x', {signal: {}})", () => replacePlainLinks('x', {signal: {}})],
	["replacePlainLinks('x', callback, 42)", () => replacePlainLinks('x', () => {}, 42)],
	["replacePlainLinks('x', callback, undefined, 'fast')", () => replacePlainLinks('x', () => {}, undefined, 'fast')],
	["replacePlainLinks('', {timeout: -1})", () => replacePlainLinks('', {timeout: -1})],
	["replacePlainLinks(42, callback)", () => replacePlainLinks(42, () => {})],
].map(async ([call, fn]) => `${call}: ${await outcome(fn)}`))).join('\n'));
{
	const already = new AbortController();
	already.abort();
	const later = new AbortController();
	const pending = outcome(() => replacePlainLinks('See https://example.com/never', {signal: later.signal}));
	await sleep(200);
	later.abort(new Error('the user left'));
	const callbackAnswer = await new Promise(resolve => {
		const controller = new AbortController();
		replacePlainLinks('See https://example.com/never', resolve, undefined, {signal: controller.signal});
		setTimeout(() => controller.abort(), 200);
	});
	show('api: signal', [
		`already aborted: ${await outcome(() => replacePlainLinks('See https://example.com/', {signal: already.signal}))}`,
		`already aborted, no links: ${await outcome(() => replacePlainLinks('plain text', {signal: already.signal}))}`,
		`aborted with a reason while waiting: ${await pending}`,
		`AbortSignal.timeout(300): ${await outcome(() => replacePlainLinks('See https://example.com/never', {signal: AbortSignal.timeout(300)}))}`,
		`callback form, aborted: ${util.inspect(callbackAnswer)}`,
	].join('\n'));
	dropHanging();
}

// ----- How links are replaced -----
const pairs = async (label, inputs, options) => {
	const lines = [];
	for (const input of inputs) {
		// eslint-disable-next-line no-await-in-loop
		lines.push(input, `=> ${await replacePlainLinks(input, options)}`, '');
	}

	show(label, lines.join('\n').trimEnd());
};

await pairs('behaviour: what counts as the end of a link', [
	'See https://example.com/page.',
	'Is it https://example.com/page?',
	'(see https://example.com/page).',
	'https://en.wikipedia.org/wiki/Bent_(band)',
	'"https://example.com/page", she said',
	'*https://example.com/page*',
	'Port http://example.com:8080/page',
]);
await pairs('behaviour: left as written, never requested', [
	'[docs](https://example.com/page)',
	'![logo](https://example.com/logo)',
	'<https://example.com/page>',
	'[1]: https://example.com/page',
	'<a href="https://example.com/page">x</a>',
	'`https://example.com/page`',
	'www.example.com/page and //example.com/page',
	'ftp://example.com/file and mailto:someone@example.com',
	'https://user:secret@example.com/page',
	'https://example.com/cat.png',
]);
await pairs('behaviour: left as written after a lookup', [
	'Image by content type: https://example.com/logo',
	'Not found: https://example.com/missing',
	'Server error: https://example.com/down',
	'Not HTML: https://example.com/plain and https://example.com/json',
	'No title: https://example.com/notitle',
]);
{
	seen.length = 0;
	const started = Date.now();
	const answer = await replacePlainLinks('https://example.com/a https://example.com/b https://example.com/a https://example.com/pic.png https://example.com/logo');
	const took = Date.now() - started;
	show('behaviour: the requests for a text with five links (the fixture saw, in order)', `${answer}\n\n${seen.join('\n')}`);
	show('behaviour: title lookups start 100 ms apart', took >= 100 ? 'the whole call took at least 100 ms' : `took ${took} ms`);
}

await pairs('behaviour: titles (read by get-title-at-url)', [
	'https://docs.example.com/guide',
	'https://example.com/colon',
	'https://example.com/heading',
	'https://example.com/latin1',
	'https://example.com/gzip',
	'https://example.com/newline',
	'https://example.com/old',
	'https://example.com/contains-url',
]);
await pairs('behaviour: {{source}}', [
	'https://www.example.co.uk/page',
	'https://someone.github.io/page',
	'https://docs.example.com/guide',
	'http://192.0.2.10/page',
	'http://localhost/page',
	'http://intranet/page',
	'http://www.example.notatld/page',
], {template: '{{source}}'});
show('behaviour: requests for http://intranet/page', await (async () => {
	seen.length = 0;
	tunnels.length = 0;
	await replacePlainLinks('http://intranet/page');
	return `${seen.length} served, ${tunnels.length} reached the proxy`;
})());
await pairs('behaviour: the default template escapes markdown characters in the title', ['https://example.com/tricky', 'https://example.com/amp', 'https://example.com/mustache']);
show('behaviour: templates', (await Promise.all([
	'[{{title}}]({{url}})',
	'[{{{title}}}]({{url}})',
	'[{{&title}}]({{url}})',
	'{{title}} ({{source}})',
	'{{#title}}has a title{{/title}}',
	'{{^nope}}no nope{{/nope}}',
	'{{! a comment }}{{title}}',
	'{{nope}}|{{title}}',
	'fixed text',
].map(async template => `${template}\n=> ${await replacePlainLinks('https://example.com/amp', {template})}`))).join('\n\n'));
show('behaviour: a link that appears several times is looked up once', await (async () => {
	seen.length = 0;
	const answer = await replacePlainLinks('https://example.com/twice and again https://example.com/twice');
	return `${answer}\nrequests: ${seen.length}`;
})());

// ----- Commands -----
const cliPath = path.join(pkgDir, typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[PACKAGE]);
const cli = (args, {input = '', env = {}} = {}) => run(process.execPath, [cliPath, ...args], {env: {...routed, ...env}, input});
// A page's terminal transcript: what the command printed (stdout, then stderr).
const transcript = async (args, options) => {
	const {stdout, stderr} = await cli(args, options);
	return `${stdout}${stderr}`.replace(/\n+$/, '');
};

writeFileSync('notes.md', 'From a file: https://example.com/\n\nAnd an image: https://example.com/cat.png\n');
show('commands: --help', (await cli(['--help'])).stdout.replace(/\n+$/, ''));
show('commands: help stream and exit code', await cli(['--help']).then(r => `exit ${r.code}, stdout ${r.stdout.length} characters, stderr ${r.stderr.length}`));
show('commands: -h equals --help', (await cli(['-h'])).stdout === (await cli(['--help'])).stdout);
for (const [args, input] of [
	[['--version']], [['-v']],
	[['Source: https://example.com']],
	[['Source: https://example.com', '-t', '[{{title}}]({{url}})']],
	[['Tom: https://example.com/amp']],
	[['Tom: https://example.com/amp', '-t', '"[{{title}}]({{url}})", *{{source}}*']],
	[['-i', 'notes.md']],
	[['-i', 'notes.md', '-t', '<{{url}}> {{title}}']],
	[[], 'From stdin: https://example.com/\n'],
	[['-'], 'From stdin: https://example.com/\n'],
	[['-i', '-'], 'From stdin: https://example.com/\n'],
	[[], ''],
	[['https://example.com/slow?ms=1500', '--timeout', '300']],
	[['https://example.com/slow?ms=1500', '--timeout=3000']],
	[['first https://example.com/', 'second https://example.com/new']],
	[['-i', 'missing.md']],
	[['-i']],
	[['--timeout', 'soon', 'x']],
	[['--timeout', '0', 'x']],
	[['--foo', 'x']],
	[['x', '-t', '{{> partial}}']],
	[['www.example.com/page']],
]) {
	const {code} = await cli(args, {input});
	const shown = args.map(arg => (/[\s{}<>*?]/.test(arg) || arg === '' ? `"${arg}"` : arg)).join(' ');
	// eslint-disable-next-line no-await-in-loop
	show(`commands: ${input ? `printf ${JSON.stringify(input.trimEnd())} | ` : ''}markdown-plain-link-replacer ${shown}`.trimEnd(), `${await transcript(args, {input})}\nexit ${code}`);
}

writeFileSync('notes-linked.md', (await cli(['-i', 'notes.md'])).stdout);
show('commands: notes-linked.md after -i notes.md > notes-linked.md (JSON string)', JSON.stringify(readFileSync('notes-linked.md', 'utf8')));
show('commands: npx markdown-plain-link-replacer (in this project)', text(await run('npx', ['markdown-plain-link-replacer', '"Source: https://example.com"'], {shell: true, env: routed})));

// ----- Recipes -----
if (SAMPLES) {
	for (const [file, template] of [['hogansample.md', '[{{title}}]({{url}}) from {{source}}'], ['wikialistsample.md', undefined]]) {
		const input = readFileSync(path.join(SAMPLES, file), 'utf8');
		const recorded = readFileSync(path.join(SAMPLES, file.replace('.md', '-output.md')), 'utf8');
		// eslint-disable-next-line no-await-in-loop
		const output = await replacePlainLinks(input, {template});
		const changed = output.split('\n').filter(line => !input.split('\n').includes(line));
		const differ = output.split('\n').map((line, index) => [line, recorded.split('\n')[index]]).filter(([a, b]) => a !== b);
		show(`recipes: ${file}${template ? ` with -t "${template}"` : ''}: the lines that changed`, changed.join('\n'));
		show(`recipes: ${file}: the same as test/fixtures/${file.replace('.md', '-output.md')}?`, differ.length === 0 ? 'yes, line for line' : differ.map(([a, b]) => `2.0.0:    ${a}\nrecorded: ${b}`).join('\n'));
	}

	copyFileSync(path.join(SAMPLES, 'hogansample.md'), 'answer.md');
	show('recipes: markdown-plain-link-replacer -i answer.md -t "[{{title}}]({{url}})"', await transcript(['-i', 'answer.md', '-t', '[{{title}}]({{url}})']));
}

await example('recipes: a whole README, with one deadline', async () => {
	const readme = 'Docs: https://docs.example.com/guide\nSlow: https://example.com/never\n';
	const markdown = await replacePlainLinks(readme, {signal: AbortSignal.timeout(500)}).catch(error => {
		console.log(error.name);
		return readme;
	});
	console.log(markdown);
});
dropHanging();
await example('recipes: a whole README, with a short timeout per page instead', async () => {
	const readme = 'Docs: https://docs.example.com/guide\nSlow: https://example.com/never\n';
	console.log(await replacePlainLinks(readme, {timeout: 500}));
});
dropHanging();
await example('recipes: plain markdown links', async () => {
	console.log(await replacePlainLinks('Read https://docs.example.com/guide first.', {template: '[{{title}}]({{url}})'}));
});
await example('recipes: keep the address visible', async () => {
	console.log(await replacePlainLinks('Read https://docs.example.com/guide first.', {template: '{{title}} (<{{url}}>)'}));
});
await example('recipes: a reference-style list at the end', async () => {
	const input = 'Read https://docs.example.com/guide and https://en.wikipedia.org/wiki/Bespin.';
	const found = [];
	const body = await replacePlainLinks(input, {template: '[{{title}}][{{url}}]'});
	for (const [, url] of body.matchAll(/\]\[(https?:[^\]]+)\]/g)) {
		found.push(url);
	}

	console.log(`${body}\n\n${found.map(url => `[${url}]: ${url}`).join('\n')}`);
});

// A proxy, through Node's own environment support (the Recipes page's "Behind a proxy").
writeFileSync('proxy.mjs', homeCode);
show('recipes: HTTPS_PROXY without NODE_USE_ENV_PROXY', text(await run(process.execPath, ['proxy.mjs'], {env: {...baseEnv}})));
show('recipes: NODE_USE_ENV_PROXY=1 HTTPS_PROXY=<proxy> node proxy.mjs', text(await run(process.execPath, ['proxy.mjs'], {env: {...baseEnv, NODE_USE_ENV_PROXY: '1'}})));
tunnels.length = 0;
await run(process.execPath, ['proxy.mjs'], {env: {...baseEnv, NODE_USE_ENV_PROXY: '1'}});
show('recipes: what the proxy received', tunnels.join('\n') || 'nothing');
show('recipes: undici version', JSON.parse(readFileSync(path.join(here, 'node_modules', 'undici', 'package.json'), 'utf8')).version);
show('recipes: node --import ./use-proxy.mjs proxy.mjs (undici EnvHttpProxyAgent)', await (async () => {
	writeFileSync('use-proxy.mjs', "import {setGlobalDispatcher, EnvHttpProxyAgent} from 'undici';\n\nsetGlobalDispatcher(new EnvHttpProxyAgent());\n");
	return text(await run(process.execPath, ['--import', './use-proxy.mjs', 'proxy.mjs'], {env: {...baseEnv}}));
})());

if (BASH && existsSync(BASH)) {
	mkdirSync('docs', {recursive: true});
	writeFileSync('docs/a.md', 'A: https://example.com/\n');
	writeFileSync('docs/b.md', 'B: https://docs.example.com/guide\n');
	const loop = `for file in docs/*.md; do
  markdown-plain-link-replacer -i "$file" > "$file.tmp" && mv "$file.tmp" "$file"
done
cat docs/*.md`;
	writeFileSync('loop.sh', `${loop}\n`);
	const binDir = path.join(here, 'node_modules', '.bin');
	show('recipes: every markdown file in a folder, in place', text(await run(BASH, ['loop.sh'], {env: {...routed, PATH: `${binDir}${path.delimiter}${process.env.PATH}`}})));
	show('recipes: the loop, as written', loop);
}

// ----- old versions -----
if (V1116) {
	const oldPkg = JSON.parse(readFileSync(path.join(V1116, 'node_modules', PACKAGE, 'package.json'), 'utf8'));
	const oldCli = path.join(V1116, 'node_modules', PACKAGE, typeof oldPkg.bin === 'string' ? oldPkg.bin : Object.values(oldPkg.bin)[0]);
	// 1.1.16 looks pages up with request 2.88, which reads HTTP_PROXY and HTTPS_PROXY itself (no NODE_USE_ENV_PROXY), and
	// trusts the CA through NODE_EXTRA_CA_CERTS, which Node reads only at start: so its examples run in a child.
	const oldEnv = {HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl, NODE_EXTRA_CA_CERTS: CA_FILE, NO_PROXY: '', NODE_OPTIONS: preload('guard.cjs')};
	writeFileSync(path.join(V1116, 'examples.cjs'), `'use strict';
const linkReplacer = require('markdown-plain-link-replacer');
console.log('require() keys:', Object.keys(linkReplacer).join(', '));
const call = (markdown, template) => new Promise(resolve => {
  try {
    linkReplacer.replacePlainLinks(markdown, resolve, template);
  } catch (error) {
    resolve('throws ' + error.name + ': ' + error.message);
  }
  setTimeout(() => resolve('(no callback within 15 s)'), 15000).unref();
});
(async () => {
  for (const [markdown, template] of [
    ['Source: https://en.wikipedia.org/wiki/Bespin'],
    ['  http://starwars.wikia.com/wiki/Bespin  ', '[{{title}}]({{url}}) from {{source}}'],
    ['See https://docs.example.com/guide.'],
    ['Release: https://example.com/colon'],
    ['Tom: https://example.com/amp'],
    ['Tricky: https://example.com/tricky'],
    ['Tom &amp; Jerry, see https://example.com/'],
    ['\`https://example.com/\`'],
  ]) {
    console.log(JSON.stringify(markdown), '=>', JSON.stringify(await call(markdown, template)));
  }
})();
`);
	show('v1.1.16: installed', `${PACKAGE}@${oldPkg.version}`);
	show('v1.1.16: examples with the callback (JSON strings)', text(await run(process.execPath, ['examples.cjs'], {cwd: V1116, env: oldEnv})));
	for (const args of [['--help'], ['-h'], ['--version'], ['Source: https://example.com'], ['www.example.com/page'], ['http://192.0.2.10/page']]) {
		// eslint-disable-next-line no-await-in-loop
		const r = await run(process.execPath, [oldCli, ...args], {env: oldEnv});
		show(`v1.1.16: cli ${args.join(' ')}`, `exit ${r.code}\n${r.stdout.trimEnd()}${r.stderr.split('\n').filter(line => /^\w*Error\b/.test(line)).slice(0, 1).map(line => `\n${line}`).join('')}`.trimEnd());
	}
}

// ----- the golden capture, replayed today (L-020, L-113) -----
if (GOLDEN && V1116) {
	const helpers = ['codec.cjs', 'fixture-server.cjs'];
	const samples = [path.join(GOLDEN, '..', 'fixtures', 'wikialistsample.md'), path.join(GOLDEN, '..', 'fixtures', 'hogansample.md')];
	for (const target of [V1116, here]) {
		for (const file of ['capture-1.1.16.cjs', ...helpers]) {
			copyFileSync(path.join(GOLDEN, file), path.join(target, file));
		}

		for (const file of samples) {
			copyFileSync(file, path.join(target, path.basename(file)));
		}
	}

	// 2.0.0 needs four changes, none to the recorded cases:
	// 1. its bin is dist/cli.mjs, read from package.json (1.1.16's is cli.js);
	// 2. 1.1.16's dependency list names packages 2.0.0 does not have;
	// 3. fetch ignores HTTP_PROXY unless the process started with NODE_USE_ENV_PROXY=1 and the variables set, and the
	//    capture sets them only after its server is listening: install undici's EnvHttpProxyAgent once they are set, in
	//    this process and (through NODE_OPTIONS) in the command line children;
	// 4. fetch tunnels http: links with CONNECT host:80, which fixture-server.cjs hands to its TLS server; the copy hands
	//    them to its plain server. NODE_TLS_REJECT_UNAUTHORIZED=0, which the capture already sets, covers the certificate.
	const script = readFileSync('capture-1.1.16.cjs', 'utf8')
		.replace("const cli = path.join(path.dirname(require.resolve('markdown-plain-link-replacer/package.json')), 'cli.js');",
			"const cli = (manifest => path.join(path.dirname(require.resolve('markdown-plain-link-replacer/package.json')), typeof manifest.bin === 'string' ? manifest.bin : Object.values(manifest.bin)[0]))(require('markdown-plain-link-replacer/package.json'));")
		.replace('const dependency = name => require(`${name}/package.json`).version;',
			"const dependency = name => { try { return require(`${name}/package.json`).version; } catch { return 'none'; } };")
		.replace("process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';",
			"process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';\n  require('./route.cjs');\n  process.env.NODE_OPTIONS = `--require \"${path.join(__dirname, 'route.cjs').split(path.sep).join('/')}\"`;");
	const server = readFileSync('fixture-server.cjs', 'utf8')
		.replace("    log(request, 'proxy', request.url);\n",
			"    log(request, 'proxy', request.url);\n    if (!request.url.endsWith(':443')) {\n      socket.write('HTTP/1.1 200 Connection Established\\r\\n\\r\\n');\n      server.emit('connection', socket);\n      return;\n    }\n\n");
	writeFileSync('capture-1.1.16-on-2.0.0.cjs', script);
	writeFileSync('fixture-server.cjs', server);
	show('golden: the copies patched for 2.0.0', `capture: ${script === readFileSync(path.join(GOLDEN, 'capture-1.1.16.cjs'), 'utf8') ? 'unchanged' : 'bin path, dependency lookup, proxy agent'}; fixture server: ${server === readFileSync(path.join(GOLDEN, 'fixture-server.cjs'), 'utf8') ? 'unchanged' : 'CONNECT to port 80 served in plain HTTP'}`);

	// One after the other: the capture has timing cases.
	const today = await run(process.execPath, ['capture-1.1.16.cjs'], {cwd: V1116, env: {NODE_OPTIONS: ''}});
	const now = await run(process.execPath, ['capture-1.1.16-on-2.0.0.cjs'], {env: {NODE_OPTIONS: ''}});
	const want = JSON.parse(readFileSync(path.join(GOLDEN, '1.1.16.json'), 'utf8'));
	// A link title in the default or a custom template, masked: 2.0.0 reads titles with get-title-at-url 3 (CHANGELOG,
	// Changed), so "[Page](url)" becomes "[Page /page](url)" for every fixture page.
	const mask = value => JSON.stringify(value).replace(/\[[^\]]*\]\((https?:)/g, '[...]($1');
	const compare = (label, result) => {
		if (result.code !== 0) {
			show(label, `capture failed, exit ${result.code}\n${result.stderr.split('\n').slice(0, 5).join('\n')}`);
			return;
		}

		const got = JSON.parse(result.stdout);
		const answer = entry => ({returned: entry.returned, threw: entry.threw?.$error && `${entry.threw.$error}`, calls: entry.calls.map(c => c.args), uncaught: entry.uncaught?.map(u => u.$error), unhandled: entry.unhandledRejections?.map(u => u.$error)});
		const timing = entry => JSON.stringify(entry.calls.map(c => c.sync));
		// Requests: method and URL, without the CONNECT lines and without how each arrived (1.1.16's request sent
		// absolute URLs to the proxy; fetch tunnels every link).
		const lines = entry => JSON.stringify((entry.requests ?? []).filter(line => !/^proxy CONNECT /.test(line)).map(line => line.replace(/^\S+ /, '')));
		const byName = new Map(got.cases.map(entry => [entry.name, entry]));
		let same = 0;
		let sameAnswer = 0;
		let sameMasked = 0;
		let sameTiming = 0;
		let sameRequests = 0;
		let sameRequestSet = 0;
		const differing = [];
		const requestDiffs = [];
		for (const entry of want.cases) {
			const current = byName.get(entry.name);
			if (!current) {
				differing.push(`${entry.name}: missing`);
				continue;
			}

			same += JSON.stringify(current) === JSON.stringify(entry) ? 1 : 0;
			sameTiming += timing(current) === timing(entry) ? 1 : 0;
			if (lines(current) === lines(entry)) {
				sameRequests++;
			} else {
				const set = entry => JSON.stringify([...new Set(JSON.parse(lines(entry)))].sort());
				sameRequestSet += set(current) === set(entry) ? 1 : 0;
				requestDiffs.push(`${entry.name}: 1.1.16.json ${lines(entry)}, now ${lines(current)}`);
			}

			if (JSON.stringify(answer(current)) === JSON.stringify(answer(entry))) {
				sameAnswer++;
			} else if (mask(answer(current)) === mask(answer(entry))) {
				sameMasked++;
			} else {
				const describe = e => (e.threw ? `throws ${e.threw.$error}: ${e.threw.$throws}` : e.calls.map(c => JSON.stringify(c.args).slice(0, 160)).join(' ') + (e.uncaught ? ` uncaught ${e.uncaught.map(u => u.$error)}` : '') + (e.unhandledRejections ? ` unhandled ${e.unhandledRejections.map(u => u.$error)}` : '')) || (e.returned ? `returns ${JSON.stringify(e.returned).slice(0, 60)}` : 'no callback');
				differing.push(`${entry.name}: 1.1.16.json ${describe(entry)}, now ${describe(current)}`);
			}
		}

		const cliSame = want.cli.filter(entry => {
			const c = got.cli.find(each => each.name === entry.name);
			return c && c.status === entry.status && c.stdout === entry.stdout && c.stderrError === entry.stderrError;
		}).length;
		const cliMasked = want.cli.filter(entry => {
			const c = got.cli.find(each => each.name === entry.name);
			return c && c.status === entry.status && mask(c.stdout) === mask(entry.stdout) && c.stderrError === entry.stderrError;
		}).length;
		const cliDiffs = want.cli.map(entry => [entry, got.cli.find(each => each.name === entry.name)]).filter(([entry, c]) => !c || c.status !== entry.status || mask(c.stdout) !== mask(entry.stdout) || c.stderrError !== entry.stderrError)
			.map(([entry, c]) => `${entry.name}: 1.1.16.json exit ${entry.status} ${JSON.stringify(entry.stdout).slice(0, 70)} ${entry.stderrError}, now exit ${c?.status} ${JSON.stringify(c?.stdout ?? '').slice(0, 70)} ${c?.stderrError ?? ''}`.trimEnd());
		show(label, [
			`${got.package}; dependencies ${Object.entries(got.dependencies).filter(([, v]) => v !== 'none').map(([k, v]) => `${k}@${v}`).join(', ')}`,
			`${want.cases.length} calls: ${sameAnswer} with the same answer, ${sameMasked} more the same once link titles are masked, ${want.cases.length - sameAnswer - sameMasked} different; ${sameTiming} with the same timing (callback before or after the call returns); ${sameRequests} with the same requests in the same order, ${sameRequestSet} more with the same set; ${same} identical in every recorded detail`,
			`${want.cli.length} command line runs: ${cliSame} identical (exit code, stdout, the error line), ${cliMasked - cliSame} more once link titles are masked`,
			'answers that differ (titles masked):',
			...differing,
			'command line runs that differ (titles masked):',
			...cliDiffs,
			'requests that differ:',
			...requestDiffs,
		].join('\n'));
	};

	compare('golden: 1.1.16 installed today against test/golden/1.1.16.json', today);
	compare('golden: 2.0.0 against test/golden/1.1.16.json (the copies patched as above)', now);
}

// ----- the oldest Node line in engines (L-106) -----
// OLDEST_NODE=<major> reruns this whole script under that Node (downloaded by npx), with its folder first on PATH so the
// shells and bins the cases spawn use it too, and saves that run's output as wiki-verify.node<major>.out.txt here.
// Compare: wikiwright.py diffout <this run's output> wiki-verify.node<major>.out.txt. Every difference is a page claim to
// scope by version.
const {OLDEST_NODE, WIKI_VERIFY_CHILD} = process.env;
if (OLDEST_NODE && !WIKI_VERIFY_CHILD) {
	const found = await run('npx', ['-y', '-p', `node@${OLDEST_NODE}`, 'node', '-p', 'process.execPath'], {shell: isWindows, env: {NODE_OPTIONS: ''}});
	const oldNode = found.stdout.trim().split('\n').at(-1);
	const rerun = await run(oldNode, [fileURLToPath(import.meta.url)], {env: {WIKI_VERIFY_CHILD: '1', PATH: `${path.dirname(oldNode)}${path.delimiter}${process.env.PATH}`}});
	writeFileSync(`wiki-verify.node${OLDEST_NODE}.out.txt`, rerun.stdout);
	show(`oldest node: node@${OLDEST_NODE}`, `${(await run(oldNode, ['--version'])).stdout.trim()}, exit ${rerun.code}, output saved as wiki-verify.node${OLDEST_NODE}.out.txt`);
}

proxy.close();
plain.close();
secure.close();
