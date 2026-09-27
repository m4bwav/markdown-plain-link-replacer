---
title: Modernization and v2 release
kind: plan
status: active
date: 2026-09-27
verified: 2026-09-27
stale_after: never
tags: [v2, plan, npm, github-actions, tests, release, network]
summary: "the living plan for markdown-plain-link-replacer 2.0.0: survey, what 1.1.16 gets wrong, decisions D1-D15 and exceptions E1-E14, the v2 API, build and test strategy, phases 0-7 with checkboxes, dispositions, security, verification checklist"
---

# Modernization and v2.0.0 release plan: markdown-plain-link-replacer

The package-modernize skill's eight phases applied to markdown-plain-link-replacer 1.1.16, the last package in Mark's inventory and the one that consumes three of the others. Evidence lands in [../log.md](../log.md); the survey and capture findings are in [../notes/2026-09-27-phase-0-survey-baseline-and-capture.md](../notes/2026-09-27-phase-0-survey-baseline-and-capture.md). The reference runs are is-an-image-url and stack-exchange-markdown-retriever (network packages with a fixture server) and format-json-files (the last run).

## Status

Active. Plan ruled 2026-09-27: Mark accepted every recommendation (D1-D15, E1-E14) and asked for anything else that makes the package easy to use, maintain and useful; added: the CLI reads stdin (A1) and takes --timeout (in D6). Phase 2 under way.

## Goal

- Works from `import` and `require` with types, on Node 20 to 26, Bun and Deno.
- Depends on get-title-at-url 3, is-an-image-url 2 and replace-string-at-position 2, and on nothing deprecated or vulnerable: 12 runtime dependencies (171 installed packages, request among them) become 4.
- For every captured case 2.x finds the same links, looks up the same pages and writes the same text as 1.1.16, except the exceptions below, each named once in the golden test and in the changelog.
- Never crashes the caller's process and always calls back or settles; every lookup has a timeout; `npm test` never touches the network.
- Released through trusted publishing with Mark's approval, verified from the registry.

## Where it stands (survey 2026-09-27)

| Fact | Value | Evidence |
|---|---|---|
| Published version, date, downloads, dependents | 1.1.16 of 2018-04-28; about 100 a month; 0 dependents (registry and code search) | survey note |
| Source, build, tests | CommonJS `index.js`, `lib/` (4 files), meow 3 `cli.js`; no build; ava 0.19 tests that fetch live pages | clone |
| Entry points | `require('markdown-plain-link-replacer').replacePlainLinks(markdown, callback, [template])`; bin `markdown-plain-link-replacer "<markdown>"`, `-i file`, `-t template` | README |
| Runtime dependencies | 12: get-title-at-url ^1.1.6, is-an-image-url ^1.0.3, replace-string-at-position ^1.0.4, url-regex ^4.1.1, parse-domain 0.2.1, hogan.js 3.0.2, he 1.1.1, bluebird ~3.5.0, array-iterate ^1.1.0, debug ^3.1.0, is-url 1.2.4, meow 3.7.0 | survey note |
| Issues, pull requests, forks | No issues ever; 8 open Snyk pull requests (#4, #5 meow; #6 to #11 get-title-at-url 2.0.0); 9 snyk-fix branches; 1 fork (gitter-badger, 2016) | survey note |
| Alerts, webhooks, secrets, security features | 1 alert (url-regex ReDoS, high, no patched version); webhooks Snyk 14564190, 278463577, Travis 83047827; no secrets; scanning off; workflow permissions write | survey note |
| Dead services | Travis (`.travis.yml`, badge, webhook), Snyk (badge, 2 webhooks, branches, pull requests), Coveralls, David, nodei.co, Gitter (badges) | survey note |
| README images | 7; 6 to fix | check-readme-images.mjs |
| Leaked credentials | None in history or in any version's scripts | survey note |
| Baseline | xo 0.18 crashes on Node 24; ava 17 pass, 2 fail (live titles changed); snyk needs a login | log |
| Golden capture | 164 library and 18 CLI cases against a local fixture server, byte-identical twice; commit 87e88c6 | `test/golden/1.1.16.json` |

## What 1.1.16 gets wrong, confirmed, and what v2 does

Numbers match the survey note's list. "E" marks a named exception in the golden test.

1. Trailing punctuation (`,` `;` `?` `!` and a closing `]` `>` `'` or backtick) is swallowed into the link and removed from the text. **Fix (E4).**
2. A link followed by `.` or `...` is not replaced at all. **Fix (E4).**
3. IP, `localhost` and unknown-TLD links crash the process (parse-domain returns null); `www.` links without a scheme crash it too; protocol-relative links never call back. **Fix (E2, E3).**
4. The whole text is HTML-decoded, so entities in ordinary text change. **Fix (E5)**: text outside a replaced link is left byte for byte.
5. Links in code spans and code blocks are replaced. **Fix (E7).**
6. The default template HTML-escapes the title and the URL (`Tom &amp; Jerry`, `?a=1&amp;b=2`) and does not escape `[` or `]` in a title. **Fix (E6)** for the default template; custom templates keep hogan's escaping exactly.
7. Title text comes from article-title (cuts at unspaced `-` or `/`, prefers `article h1`, joins two titles, mojibake for latin-1, nothing for gzip). **Changes with get-title-at-url 3 (E1).**
8. Only status 200 gives a title; images are recognised case-sensitively. **Changes with the new dependencies (E1, E9).**
9. A number or object template deletes the link; an unclosed section never calls back. **Refuse (E10)**: TypeError at the call.
10. `[1]:  url` (two spaces) and `[1]:url` are replaced, breaking the reference definition; autolinks `<url>` are mangled. **Fix (E8).**
11. No timeout on the title lookup: a page that never answers means no callback. **Fix (E11)**: 10 s per page by default.
12. A non-ASCII path is never looked up (request refuses it). **Fix (E12)**: fetch encodes it.
13. The CLI prints `undefined` for no input, a missing file or a flag it does not know, with exit 0; `-h` prints nothing. **Fix (E14).**
14. url-regex 4 has a ReDoS (GHSA-v4rh-8p82-6h5w, every version up to 5.0.0, no fix). **Replaced** by a linear-time scanner.

## Decisions (recommendation first; Mark rules in the plan review, silence means the recommendation stands)

| # | Question | Recommendation | Why | Alternative |
|---|---|---|---|---|
| D1 | Compatibility promise | For every case in `1.1.16.json`, 2.x finds the same links, looks up the same pages in the same order (method and URL) and writes the same text, except E1 to E14 below. The title exception (E1) is applied mechanically: the golden test computes each fixture page's title with 1.1.16's extractor (article-title 2.0.0, a dev dependency of the test only) and with get-title-at-url 3's exported `extractTitle`, and swaps one for the other in the recorded output. | Zero dependents and about 100 downloads a month; the bugs mangle users' text, so fixing them in the one name is honest in a major, and each fix is a changelog line. The mechanical title swap keeps every other byte of every recorded output under test. | Keep `replacePlainLinks` exact to 1.1.16 for one major and add the fixes under a new name: it would mean re-implementing article-title and request's quirks, and keeping crashes. |
| D2 | Export shape | ESM: named `replacePlainLinks` and a default export `{replacePlainLinks}`. CommonJS: `require()` returns `{replacePlainLinks, default}`, as 1.1.16 returned an object. Types for both. Bin `markdown-plain-link-replacer`. | 1.1.16's README calls `require(...).replacePlainLinks`; that line keeps working. | Default-export the function (a new shape; no reason). |
| D3 | Behaviour at the edges | As listed in the exceptions table below; everything else as recorded, including: falsy markdown calls back synchronously with the same value; a text without links calls back asynchronously with the text; a repeated link is looked up once and every valid occurrence replaced; links already after `](` or in an HTML attribute are left; images (by extension, without a request, or by content type) are left. | The capture pins each. | Make the falsy call back asynchronously too (one more exception, no user benefit). |
| D4 | Major? | 2.0.0. | Node floor, exports map, the fixes and the Promise form change the package's shape; a minor would hide them. A patch could only swap request out of the dependencies, and the crashes would stay. | 1.2.0 with fixes only (dishonest about the floor). |
| D5 | Runtime dependencies | get-title-at-url ^3.0.0, is-an-image-url ^2.0.0, replace-string-at-position ^2.0.0 (Mark's own), tldts ^7 (the source name, from the Public Suffix List, private domains on, so someone.github.io stays as 0.2.1 gave it; one dependency, tldts-core). Inlined: a link scanner in place of url-regex (linear time, same matches as url-regex 4 on every captured case, then trailing punctuation trimmed), and a mustache renderer in place of hogan.js (variables `{{x}}` with hogan's five-character HTML escape, `{{{x}}}`, `{{&x}}`, sections and inverted sections over the three values, comments; anything else a TypeError). Dropped: bluebird, array-iterate, debug, he, is-url, meow, parse-domain, url-regex, hogan.js. | url-regex has a ReDoS with no fix. hogan.js 3.0.2 installs nopt and mkdirp 0.3.0 (deprecated) for its CLI and is unmaintained since 2014; the renderer needed for three values is about 80 lines and the golden template cases pin it. tldts is maintained (7.4.15, 2026-09-23) and names the source the way parse-domain 0.2.1 did for every captured host it could name. | Keep hogan.js (exact for every template, with deprecated transitive packages); linkify-it for links (maintained, but it finds different links: many golden cases would become exceptions); drop is-an-image-url and let get-title-at-url's NOT_HTML answer images (one request per link instead of two, but image links by extension would then be fetched). |
| D6 | Names | Keep `replacePlainLinks` and the bin name. Add one overload: `replacePlainLinks(markdown, options?)` returns `Promise<string>` when the second argument is not a function; `options` is `{template, timeout, signal}`. The callback form takes `(markdown, callback, template)` as before; a fourth argument `options` gives it `timeout` and `signal`. CLI flags `-i/--input`, `-t/--template`, plus `--timeout`, `-h/--help`, `-v/--version`. | is-an-image-url 2 set the same pattern; a Promise is how 2026 code calls it. Timeout and signal exist because the lookups are network calls. | Also a `fetch` option (get-title-at-url supports it, is-an-image-url does not, so it would cover half the requests). |
| D7 | Errors | Lookups never throw and never reject: a failed lookup leaves the link as written. Argument errors throw a TypeError synchronously in both forms (markdown not a string or falsy, template not a string, a template tag the renderer does not support, callback neither a function nor an options object, a bad timeout). The callback is called exactly once, asynchronously (except falsy markdown, D3). An exception thrown by the caller's callback is not caught by the package (it surfaces as the caller's own uncaught exception, as a callback's throw normally does). | 1.1.16 crashed or went silent on every one of these; a caller can only handle what is surfaced. | Reject the Promise on the first failed lookup (one bad link would lose the rest). |
| D8 | Floor and matrix | `engines.node >=20`; CI Node 20, 22, 24, 26 on Linux, plus Windows and macOS on 24, Bun and Deno. | Overlay standing decision. | |
| D9 | Language and tooling | The npm defaults: TypeScript, tsdown pinned exactly, xo, node:test, c8 95/90, publint, attw, consumer fixtures, the template workflows. | Standing decision. | |
| D10 | Lockfile and bot pull requests | New lockfile v3 (none is committed today). Close #4 to #11 after the merge, each with one comment naming the merge commit; delete the 9 snyk-fix branches. | Snyk's app was revoked on 2026-09-25; the pull requests target code that no longer exists. | |
| D11 | Dead services and README images | Remove the Snyk and Travis webhooks; three badges (npm version, CI, downloads); remove the other six (see the table below). | Dead or dropped services. | Keep the XO badge (it works; the default row is three). |
| D12 | Old files | Remove `index.js`, `cli.js`, `lib/`, `jsconfig.json`, `.travis.yml`, `.vscode/`, the ava tests; keep `test/fixtures/*.md` (the golden cases read them). | Replaced by `src/` and the templates. | |
| D13 | Release | 2.0.0-beta.1 rehearsal on `next`, then 2.0.0 on `latest`; 1.x deprecated by Mark in his terminal: `npm deprecate markdown-plain-link-replacer@"<2" "1.x depends on the deprecated request package, crashes on IP and localhost links and has no timeout; use 2.x"`. The trusted publisher is already set up (2026-09-26). | The ritual. | |
| D14 | Default branch, extras | Keep `master`. No JSR, no browser build (fetch works in browsers, but the lookups hit CORS on almost every site). | | |
| D15 | Dependents | None to notify. The inventory's order is complete after this run. | | |

### Named exceptions (each one line in the golden test and the changelog)

| # | Cases | 1.1.16 | 2.0.0 |
|---|---|---|---|
| E1 | every case with a looked-up title | article-title's text; only status 200 | get-title-at-url 3's text (spaced separators only, no h1 preference, entities, charset and gzip decoded, og:title fallback); any 2xx; text/plain and JSON pages give no title; different request headers |
| E2 | IPv4, localhost, unknown TLD | uncaught TypeError | replaced; the source is the host name |
| E3 | `www.` without a scheme, `//host` | uncaught error, or no callback | left as written, no request |
| E4 | trailing `.` `,` `;` `:` `!` `?` and an unbalanced closing `)` `]` `>` `'` `"` or backtick | swallowed into the link, or no replacement for `.` | trimmed from the link and kept in the text after the replacement |
| E5 | text with entities | whole text HTML-decoded | text left as written; a link's `&amp;` is decoded for the lookup only |
| E6 | default template | `"[{{title}}]({{url}})", *{{source}}*` with HTML escaping | the same shape without HTML escaping; `[`, `]` and `\` in the title escaped with a backslash |
| E7 | code spans, fenced and indented code | replaced | left as written |
| E8 | `[1]:  url`, `[1]:url`, `<url>` | replaced, breaking the definition or the autolink | left as written |
| E9 | `IMAGE/PNG` content type | not an image, replaced | an image, left (is-an-image-url 2) |
| E10 | template a number, an object, an unclosed section | link deleted, or no callback | TypeError at the call |
| E11 | a page that never answers | no callback | the link left after the timeout (10 s default) |
| E12 | non-ASCII and emoji paths | no request, left | looked up |
| E13 | redirect loop | 22 requests | fetch's limit (20 redirects) |
| E14 | CLI: no input, missing file, unknown flag, `-h`, `-i` without a value | `undefined` exit 0, or a stack trace | usage or the error on stderr, exit 1; `-h` prints the help; with A1, no argument reads stdin (an empty stdin prints an empty line) |
| E15 | links with a user name or password (found in Phase 2) | requested and replaced | left, not requested: fetch refuses such URLs |
| E16 | no callback, or a callback that is not a function (Phase 2, from D6) | TypeError, or an unhandled rejection | the Promise form; a non-function, non-object second argument throws a TypeError |
| E17 | a callback that throws (Phase 2, from D7) | an unhandled rejection (bluebird) | the caller's uncaught exception; the callback is called once |
| E18 | an `@` more than 256 characters after the scheme, such as an email address deep in a query (Phase 3 review) | read as user info: the link is cut after the address, requested, and left because more URL follows | the `@` is part of the path: the whole link is requested and replaced (the scanner's bound that keeps it linear) |

Small differences accepted in the Phase 3 review, not numbered because the text written is the same or the case is contrived:
`](url) url` at the very start of the text (1.1.16 replaced the second link only through its `currentUrlStart > 2`
off-by-one; 2.x leaves it, as it does anywhere else in the text); a link that is left alone because a `"` or more URL follows
gets no image check (1.1.16 checked it, then left it); and `{{constructor}}` or `{{__proto__}}` in a custom template render
empty where hogan.js printed `[object Object]`; and 1.1.16's replace step, which replaced every valid occurrence of a found
URL's text, so it could replace a short link inside a longer one (`https://a.example.io/p` inside `https://a.example.io/p).com`,
`//localhost` inside `http://localhost`, a host running into U+3000); 2.x replaces each link it found, whole. E4 also covers a
link that ends at its host name followed by punctuation (`http://example.com, and`), which 1.1.16 left unreplaced. An offline
differential of the published 1.1.16 (network stubbed) against 2.x on 13 000 generated texts found no other class
(2026-09-27, scratch script, not kept; method in the log).

### Additions after the ruling

| # | Addition | Why |
|---|---|---|
| A1 | The CLI reads the markdown from stdin when it is given `-` or no argument and stdin is not a terminal | `cat notes.md \| markdown-plain-link-replacer > out.md` is how a text filter is used; 1.1.16 needed `-i` or a quoted argument |
| A2 | README section "What it requests": every non-image http(s) link is fetched twice at most, with the timeout, from the caller's network | the security note, where users read it |

## Proposed public API (v2)

- `replacePlainLinks(markdown, callback, template?, options?)`: callback form, returns undefined; calls `callback(newMarkdown)` once.
- `replacePlainLinks(markdown, options?)`: returns `Promise<string>`. Options: `template` (string), `timeout` (milliseconds per page, default 10 000, the same value given to both lookups), `signal` (AbortSignal; an abort rejects with its reason, the one rejection).
- Throws a TypeError synchronously for the argument errors in D7.
- Types: `ReplaceOptions`, and the two overloads.
- Old name to new: `replacePlainLinks` is kept; nothing is renamed.

## Build and package specifics

- src/index.ts (ESM entry), src/require.ts (CommonJS entry: the object), src/replace-plain-links.ts (the pipeline), src/find-links.ts (scanner, code and definition skipping, punctuation trim), src/validate.ts (the three 1.1.16 checks), src/template.ts (renderer), src/source.ts (tldts with the host-name fallback), src/cli.ts.
- The pipeline keeps 1.1.16's order: every link's image check first (all in parallel), then title lookups started 100 ms apart, then the replacements in link order.
- package.json from the template; `files` allowlist; `bin`.
- Tests route every fetch to the fixture server through a `globalThis.fetch` wrapper (stack-exchange-markdown-retriever's test/helpers/api.js pattern, with the `x-fixture-url` header the server already reads); child processes load it with `node --import <file URL>`.

## Phases

### Phase 0: survey and baseline (2026-09-27, no package code changed)
- [x] Cloned to D:\m4bwa\Claude\Projects\Ai\markdown-plain-link-replacer; survey in `ai-docs/notes/2026-09-27-phase-0-survey-baseline-and-capture.md`
- [x] Old build and tests run as they are: xo crashes, ava 17 pass 2 fail (live pages)
- [x] Golden capture from the published 1.1.16 committed under `test/golden/` with its script and fixture server (commit 87e88c6; the golden JSON, the capture script, the fixture server and the codec stay as they are from here on)
- [x] everlast registered (mode repo, sync push); AGENTS.md, CLAUDE.md (the AGENTS.md import line), Copilot pointer
### Phase 1: plan
- [x] This plan and the decision record. **Stop**: Mark rules on the table. Questions: the deletions on GitHub in the cleanup (webhooks, branches) go in the Phase 4 go list.
### Phase 2: rewrite on branch v2
- [ ] Remove the old files (D12); add the templates; deny dev-only install scripts
- [ ] Golden test first, green on the first build; canary red then green (both logged); golden files unchanged since 87e88c6; then src/, the rest of test/, README, CHANGELOG, SECURITY.md, AGENTS.md
- [ ] Verified on Node 20, 22, 24, 26 and from a fresh clone (log)
- [ ] Workflows and Dependabot, actionlint and check-workflow-shell.py clean
- [ ] Pushed; pull request with a "For review" list. **Stop.**
### Phase 3: review
- [ ] Independent read-only review; findings fixed or answered; summary on the pull request
### Phase 4: CI, settings, merge, cleanup
- [ ] CI green (run id); ruleset on master before the merge; merge after Mark's review (SHA and method read back)
- [ ] One go for the cleanup list (dry run of `post-merge-cleanup.sh` with ai-docs/notes/dispositions.tsv), then `--apply --tag-ruleset`
### Phase 5: release rehearsal
- [ ] `preflight-tag-npm.sh 2.0.0-beta.1` READY; tagged; staged; **stop** for the approval; `verify-registry-npm.sh` VERIFIED
### Phase 6: release
- [ ] Changelog dated; 2.0.0 tagged and staged; **stop** for the approval; verified; 1.x deprecated by Mark and read back from the packument
### Phase 7: wrap-up
- [ ] HANDOFF around standing work; inventory row; lessons into the skill; kickoff record corrected

## Test strategy

| Layer | What it proves | How | Runs where |
|---|---|---|---|
| Golden | Every captured case, both forms (callback and Promise), with E1 to E14 applied | test/golden/golden.test.js against the fixture server | every Node line, three OSes |
| Unit | Scanner (differential against url-regex 4 on generated texts, a 1 MB adversarial input in under a second), trim, code skipping, renderer (against hogan.js 3.0.2 as a dev-only oracle), source names | node:test | every Node line |
| Functional | Timeout, abort, redirects, a slow page among fast ones, callback called once, no uncaught exception | fixture server | every Node line |
| CLI | Every captured CLI case with E14 | spawn dist/cli.mjs with the fetch wrapper | every Node line |
| Package shape | exports, types, pack list, no Node API outside the CLI and the lookups | publint, attw, pack-list test | Node 24 |
| Consumers | ESM, CJS, four TypeScript modes, the bin, Bun, Deno | tarball installed in a scratch project | CI |
| Registry | The published version works | verify-published.yml | CI after each release |

## Pull requests, issues and forks: disposition

| Item | What it is | Disposition | Comment to post |
|---|---|---|---|
| #4, #5 | Snyk: meow 3.7.0 to 8 and 6 | Close after the merge | Closed by the 2.0.0 rewrite ({SHA}): meow is gone (the CLI uses node:util parseArgs), and Snyk no longer watches this repository. |
| #6 to #11 | Snyk: get-title-at-url 1.1.8 to 2.0.0 | Close after the merge | Closed by the 2.0.0 rewrite ({SHA}): 2.0.0 depends on get-title-at-url ^3.0.0, which has no request dependency, and Snyk no longer watches this repository. |
| 9 snyk-fix branches | Bot branches (one without a pull request) | Delete | |
| gitter-badger fork | 2016 badge fork | Nothing | |

## Security

- No leaked tokens found. Webhooks Snyk (2) and Travis removed with the Phase 4 go.
- The one alert (url-regex) closes when the dependency goes; the scanner is linear and has a size test.
- The package fetches URLs found in the caller's text: the README says so plainly (it will request every non-image http and https link, including private addresses and localhost), so it must not run on untrusted text inside a network that has internal services, and it names the timeout. No input allow-list is offered as SSRF protection (L-026).
- Scanning, push protection, private vulnerability reporting on; workflow permissions read; tag ruleset admins only; the release workflow from the template.

## Badges and images: disposition

| Image or badge | What it shows now | Decision | New URL or reason |
|---|---|---|---|
| nodei.co | unmaintained service | Replace | shields.io npm version and downloads badges |
| Travis | "not found" | Replace | `https://github.com/m4bwav/markdown-plain-link-replacer/actions/workflows/ci.yml/badge.svg` |
| David | HTTP 500 | Remove | Dependabot |
| Coveralls | dropped service | Remove | no coverage service |
| Snyk | dropped service | Remove | Dependabot alerts and npm audit in CI |
| XO | works | Remove | three-badge default |
| Gitter | dead room | Remove | no chat |

## Verification checklist

The npm reference's checklist, plus: the old README's `require(...).replacePlainLinks(input, cb)` example runs and calls back; a 1 MB text of link-like noise finishes the scan in under a second; no `request`, `bluebird` or `hogan.js` in `npm ls --all --omit=dev`.

## Risks and open points

- tldts's list will name some hosts differently from parse-domain 0.2.1 over time; the golden cases pin today's answers and unit tests pin the fallback.
- get-title-at-url 3 accepts any 2xx; a 204 or 206 page is looked up where 1.1.16 left it (inside E1).

## Appendix: cleanup commands

~~~
pr	4	Closed by the 2.0.0 rewrite ({SHA}): meow is gone (the CLI uses node:util parseArgs), and Snyk no longer watches this repository.
pr	5	Closed by the 2.0.0 rewrite ({SHA}): meow is gone (the CLI uses node:util parseArgs), and Snyk no longer watches this repository.
pr	6	Closed by the 2.0.0 rewrite ({SHA}): 2.0.0 depends on get-title-at-url ^3.0.0, which has no request dependency, and Snyk no longer watches this repository.
branch	snyk-fix-a1249a24
hook	14564190
hook	278463577
hook	83047827
~~~
(#7 to #11 as #6; the final file is ai-docs/notes/dispositions.tsv, written in Phase 4.)

## Next single action

Mark rules on D1 to D15 and E1 to E14.
