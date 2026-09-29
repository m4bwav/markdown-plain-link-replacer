---
title: GitHub wiki written and published for 2.0.0
kind: note
date: 2026-09-29
verified: 2026-09-29
stale_after: 2027-03-29
tags: [wiki, docs, 2.0.0, github, wikiwright, golden, proxy, tls]
summary: "the ten wiki pages, where their git working copy is, how every example was verified against the published 2.0.0 by the real host names through a local proxy with TLS (the script and its output beside this note), how the golden capture of 1.1.16 was replayed against both versions, the Node 20 run, the facts the README lacks, the inaccuracies in the shipped docs, and how to update the wiki; read before touching the wiki, the README's default-template or Promise-rejection sentences, AGENTS.md's capture-guard claim or the npm dist-tags"
---

# GitHub wiki for 2.0.0

## Summary

Mark asked for the repository wiki (https://github.com/m4bwav/markdown-plain-link-replacer/wiki) as the fourth real run of the wikiwright skill (m4bwav/wikiwright, released as 0.4.0 from this run). Ten pages plus sidebar and footer were written from:

- the 2.0.0 source, README, CHANGELOG, AGENTS.md, HANDOFF, log and the Phase 0 and Phase 3 notes;
- the CI workflows, the tags and releases, the pull requests (no issues exist) and the npm registry;
- the golden capture under `test/golden/`, replayed against 1.1.16 and 2.0.0.

Every output on the wiki was printed by `2026-09-29-wiki-verify.mjs` (next to this note) against `markdown-plain-link-replacer@2.0.0` installed from npm. The pages it links to were local copies served under their real host names through a local proxy; no example's answer came from the internet (see Gotchas for the stray requests during development). Its full output is `2026-09-29-wiki-verify.out.txt` (Node 24.18.0), and `2026-09-29-wiki-verify.node20.out.txt` is the same script under Node 20.20.2.

Published on 2026-09-29 as wiki commit `ab33614`. Results:

- `wikiwright.py live`: 10 pages, 0 failures; sidebar and footer rendered.
- `wikiwright.py check`: 0 errors, 0 warnings.
- `wikiwright.py outputs`: 55 outputs checked, 0 missing, 1 skipped (npm's install lines).
- Everwrite checker: 0 strong findings; the weak ones are long sentences, judged fine.

Pages: Home, Getting started, API reference, How links are replaced, Commands, Edge cases and errors, Recipes, Versions and upgrading, FAQ, Development.

## Where the pages are

`D:\m4bwa\Claude\Projects\Ai\markdown-plain-link-replacer.wiki` (a sibling of this clone, outside this repository), branch `master`, remote `origin` = `https://github.com/m4bwav/markdown-plain-link-replacer.wiki.git`. Files: `Home.md`, `Getting-Started.md`, `API-Reference.md`, `How-Links-Are-Replaced.md`, `Commands.md`, `Edge-Cases-and-Errors.md`, `Recipes.md`, `Versions-and-Upgrading.md`, `FAQ.md`, `Development.md`, `_Sidebar.md`, `_Footer.md`. Plain markdown links between pages (`[Recipes](Recipes)`), no wikilinks, LF line endings.

## How it was published

The wiki repository held the page Mark saved (commit `034e7a9`, "Initial Home page"). `wikiwright.py preflight m4bwav/markdown-plain-link-replacer --enable --clone <wiki dir>` reported `STATE: placeholder`. The pages were committed on the cloned placeholder and pushed as a plain fast-forward (`034e7a9..ab33614`). `wikiwright.py live`: 10 pages, 0 failures.

## Updating the wiki later

1. `git -C D:\m4bwa\Claude\Projects\Ai\markdown-plain-link-replacer.wiki pull --ff-only`, then edit the pages.
2. Re-verify in a scratch folder outside the repository:
   - `npm init -y`, then `npm install markdown-plain-link-replacer@<new> undici@7 typescript@6 @types/node@24`, and copy in `2026-09-29-wiki-verify.mjs` with `VERSION` changed. It changes to its own folder; openssl must be on PATH (Git for Windows has one).
   - In more scratch folders: `markdown-plain-link-replacer@1.1.16`, and the npm packages `deno` and `bun`.
   - Run `node wiki-verify.mjs > out.txt` with `OLDEST_NODE=20 RT=<deno and bun folder> PM=1 V1116=<folder> GOLDEN=<this clone's test/golden> SAMPLES=<this clone's test/fixtures> BASH=<Git Bash's bash.exe>`. Without them the Node 20, runtime, package-manager, old-version, golden, sample and shell sections are missing. It takes about fifteen minutes with the Node 20 rerun; the golden replays wait out timeouts.
   - `python <wikiwright>/scripts/wikiwright.py diffout 2026-09-29-wiki-verify.out.txt out.txt` lists every section that changed (ports normalised). Every difference is a behaviour change or a new tool version (the package managers print theirs). Diff `wiki-verify.node20.out.txt` with `out.txt` the same way: on 2026-09-29 the only differences were the routing line and the `NODE_USE_ENV_PROXY` recipe. Save the new outputs over the old (`diffout --save`).
3. `wikiwright.py outputs <wiki dir> out.txt --address ''` must report 0 missing (the pages show real host names, so no address mapping). Then `wikiwright.py check <wiki dir> --version <new>` and the everwrite checker.
4. Commit, `git push`, `wikiwright.py live m4bwav/markdown-plain-link-replacer <wiki dir>`.

Pages that name the version: Home (last line), Getting started (the Deno import, the tool versions), Commands (`--version` output), Versions and upgrading (the table, downloads, dist-tags, the replay), Development (the test count), the footer. A new major also changes the golden replay's comparison.

## How the examples were verified

Everything ran on Windows 11 with Node 24.18.0 and npm 11.16.0, in a scratch project with `markdown-plain-link-replacer@2.0.0`, `undici@7.30.0` and `typescript@6.0.3`; then the whole script again on Node 20.20.2 (npx's `node@20`, first on PATH).

- **By host name, through a proxy.** The package's lookups go through get-title-at-url and is-an-image-url to the hosts the text names, so an address substitution cannot work (the site name in the output comes from the host). The script serves every page from a plain HTTP server and a TLS server, keyed by host and path, behind a stand-in proxy on 127.0.0.1 that answers `CONNECT` by handing the socket to the TLS server (port 443) or the plain one (any other port). Node tunnels `http:` links with `CONNECT` too.
- **TLS.** A throwaway CA and a server certificate it signed for the page hosts, made by openssl at the start. Every runtime trusts only the CA: `NODE_EXTRA_CA_CERTS` for Node and Bun, `DENO_CERT` for Deno. Deno refused a single self-signed certificate marked as a CA as the server's own, so the two are separate.
- **Routing.** Node 24.18.0 children run with `NODE_USE_ENV_PROXY=1` and `HTTP_PROXY`/`HTTPS_PROXY`; Node 20.20.2 ignores that variable, so its children preload `route.cjs` (undici's `EnvHttpProxyAgent`). The script's own process uses undici's `ProxyAgent` with the CA. Deno 2.9.6 and Bun 1.4.2 read the proxy variables themselves. The script decides which route a Node has with a probe to an `.invalid` host.
- **Guard.** `guard.cjs`, preloaded everywhere through `NODE_OPTIONS` (paths with forward slashes: NODE_OPTIONS reads a backslash as an escape), refuses any socket not to 127.0.0.1. It reads the options from inside the array `net.connect()` passes, or plain http slips through.
- **Module systems, runtimes and package managers.** ESM, CommonJS (callback and Promise), Deno 2.9.6 (with and without `--allow-net`) and Bun 1.4.2 from npm; pnpm 12.6.0, Yarn 1.22.22 and Yarn 4.18.1 through corepack, and `bun add`, each installing 2.0.0 into an empty project and running the Home example.
- **Types.** `tsc --strict --module nodenext` on an ESM file, a wrong option type, a nullable markdown, and a CommonJS file.
- **Command line.** The published `dist/cli.mjs`, spawned asynchronously with standard input closed (it reads stdin when it has no argument), `npx` in the project, and a bash loop in Git Bash.
- **Sample files.** `test/fixtures/hogansample.md` and `wikialistsample.md`, run against local pages titled as their recorded `-output.md` files show: 2.0.0's output equalled both recordings line for line.
- **Old version.** 1.1.16 from npm, run as a child process (request 2.88 reads the proxy variables itself; the CA must be set at start): the README examples and five more calls, and its command line.
- **Golden capture.** `test/golden/capture-1.1.16.cjs`, run unchanged against 1.1.16 installed today: 154 of 154 calls and 18 of 18 CLI runs identical to `1.1.16.json`. Against 2.0.0 the copies needed four changes: the bin path from package.json, a dependency lookup that answers `none`, undici's `EnvHttpProxyAgent` installed after the capture sets the proxy variables (in the capture and, through `NODE_OPTIONS=--require`, its CLI children), and a fixture-server copy that serves `CONNECT host:80` in plain HTTP. `NODE_USE_ENV_PROXY=1` alone was not enough: Node reads the proxy variables at startup, and the capture sets them only once its server listens. `NODE_TLS_REJECT_UNAUTHORIZED=0`, which the capture sets at run time, covered the certificate. Result: 54 calls with the same answer, 55 more once link titles are masked, 45 different (4 of them title-only where the mask could not see it, 41 each a CHANGELOG line); 145 with the same callback timing; 116 with the same requests in order and 10 more in another order; 3 of 18 CLI runs identical and 6 more title-only. The golden files were only read. Node 20.20.2 gave the same counts.
- **The repository's own tests.** `npm test` on a `git archive` export of master (2a942e8): 400 tests in 14 suites, 396 passed, 4 skipped, 0 failed.

Not run: browsers, a global install, `npx` without a local install, the CLI's no-argument case with a terminal as stdin, Node lines other than 20.20.2 and 24.18.0.

## Facts verified while writing (not in the README)

- The command line prints with `console.log`, so `-i file > out` adds a line break: a file ending in one gains a blank line.
- Extra positional arguments to the command line are ignored without a warning.
- `-t` with the text the help and README call the default does not give the default: a user template HTML-escapes `{{title}}`, the built-in default does not and escapes markdown characters instead.
- A falsy markdown includes `0`, `false` and `NaN`, answered as given; the callback form calls back before returning only then.
- The template may come third without a callback (`replacePlainLinks(text, undefined, template)`, or `null`); `options.template` wins over it.
- The options are validated even for an empty markdown.
- An aborted signal rejects even a text with no links.
- `require()` returns an object with `default` and `replacePlainLinks`, and the CommonJS function is a different object from the ES module's.
- A single-label host (`http://intranet/page`) is not a link and makes no request.
- A link followed by a double quote is never replaced, even in prose (`"https://…", she said`).
- An https page whose certificate the runtime does not trust leaves its link silently, while http links in the same text are replaced.
- Node 24.18.0's `fetch` ignores `HTTPS_PROXY` without `NODE_USE_ENV_PROXY=1`; Node 20.20.2 has no such variable, and undici's `EnvHttpProxyAgent` preloaded works on both. Deno and Bun read the variables themselves.
- Deno without `--allow-net`, with no terminal, leaves every link unchanged with no error.
- 1.1.16's `-h` prints nothing; its `--help` is a one-paragraph description.
- Registry, read 2026-09-29: 41 versions; `latest` 2.0.0, `next` 2.0.0-beta.1; every 1.x version and 2.0.0-beta.1 are deprecated with "1.x is unmaintained; 2.0.0 is a TypeScript rewrite with the same answers, see the CHANGELOG"; downloads in the week to 2026-09-27: 168 (2.0.0), 133 (2.0.0-beta.1), 60 (1.1.16); 544 in the month, 1,511 in the year.

## Inaccuracies found in the docs

Numbered. 1 to 4 are in files that ship in the package (README, CHANGELOG, the CLI's help), so a fix reaches npm only with a release; not fixed. 5 to 7 are repository or registry state.

1. README, API table, and the CLI's `--help`: the default template is given as `"[{{title}}]({{url}})", *{{source}}*`. Passed with `-t` or `template`, that text HTML-escapes the title (`Tom &amp; Jerry`), where the built-in default writes `Tom & Jerry` and escapes markdown characters. The README's Templates section explains the default's escaping, but the table and the help present the string as if it were the default. Suggested: "Default: the shape `"[title](url)", *source*`, with markdown characters in the title escaped".
2. README, "Both forms answer a falsy markdown (`''`, `null`, `undefined`) with the same value": `0`, `false` and `NaN` are answered the same way (they are falsy); the list reads as complete.
3. README, "It exits 0 when it printed the markdown ... The result goes to stdout" and "Nothing else in the text changes": true of the function, but the command line adds a trailing line break, so a file converted with `-i file > file2` gains a blank line at the end.
4. CHANGELOG, 2.0.0: "The test suite checks this against 164 calls and 18 command-line runs recorded from the published 1.1.16". `test/golden/1.1.16.json` holds 154 calls.
5. AGENTS.md, "No test touches the internet": "the capture also refused any socket that was not to 127.0.0.1". The capture's guard wraps `net.Socket.prototype.connect` and reads `args[0].host`; `net.connect()` passes its arguments as one array, so the guard refused TLS sockets but would have let a plain http socket through. The recording is not affected: every request went through the proxy (154 of 154 identical today). Fixing the guard would mean editing the capture script, which AGENTS.md forbids; the correct form is in package-modernize's reference (L-124).
6. npm: `next` still points to 2.0.0-beta.1, older than `latest`, and 2.0.0-beta.1 carries the 1.x deprecation message ("1.x is unmaintained..."), since the deprecation range included the prerelease. HANDOFF says "2.0.0-beta.1 is on `next`" without noting either. Not touched (registry settings are Mark's).
7. The local clone still lists nine `origin/snyk-fix-*` remote-tracking branches that no longer exist on GitHub (ls-remote shows master only); `git fetch --prune` clears them. HANDOFF's "only master" is right.

## Gotchas

- The first guard (the capture's form) let plain http through: during development, before the fix, a detection probe and a few Node 20 child lookups reached the real example.com and starwars.wikia.com. None of their answers is on a page (those links came back unchanged or the probe's answer was only used to pick a route); the saved script's guard and `.invalid` probe fix both.
- `NODE_OPTIONS` drops backslashes: preload paths go in with forward slashes.
- `NODE_EXTRA_CA_CERTS` and `NODE_USE_ENV_PROXY` are read when Node starts; setting them in `process.env` later does nothing, so 1.1.16's examples run as a child process.
- The command line reads standard input when it gets no markdown argument: spawn it with stdin closed, or it waits (the golden capture's no-argument case was killed after 15 seconds).
- Yarn 1 through corepack prints `warning ..\..\package.json: No license field` on stderr from the scratch folder's parent; harmless.

Related: see also [../HANDOFF.md](../HANDOFF.md), [../log.md](../log.md), [2026-09-27-phase-0-survey-baseline-and-capture.md](2026-09-27-phase-0-survey-baseline-and-capture.md).
