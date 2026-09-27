# Log

Append-only. One line per operation: `## [YYYY-MM-DD] op | title` where op is one of add, update, supersede, verify, verify-failed, prune, handoff, index. Newest at the bottom. Never edited, only appended; this is the history the entries themselves do not carry.

## [2026-09-26] init | scaffolded

## [2026-09-27] add | Phase 0: survey, baseline, golden capture
- survey-npm.sh output and the findings: ai-docs/notes/2026-09-27-phase-0-survey-baseline-and-capture.md. No dependents; 12 runtime dependencies (request 2.88 through get-title-at-url 1.1.8 and is-an-image-url 1.0.4); 1 Dependabot alert (url-regex, high); webhooks Snyk 14564190 and 278463577, Travis 83047827; 8 open Snyk pull requests; no issues; no tokens in history or in any version's scripts.
- Baseline in a scratch clone on Node 24.18: xo 0.18 crashes (util.isDate is not a function); ava 0.19 17 pass, 2 fail (live pages' titles changed since 2018; the old suite fetches the internet); snyk needs a login.
- Published bin run in a scratch project: works (meow 3.7.0); no argument prints `undefined`, exit 0.
- Golden capture: test/golden/capture-1.1.16.cjs against test/golden/fixture-server.cjs with codec.cjs, in the scratchpad with markdown-plain-link-replacer@1.1.16 installed: 164 library cases, 18 CLI cases, run twice, byte-identical (cmp). request goes through HTTP_PROXY/HTTPS_PROXY to the fixture server (CONNECT to an in-process TLS server for https); a net.Socket.prototype.connect guard refused any socket not to 127.0.0.1 and never fired (0 matches for "capture guard" in 1.1.16.json). Found: trailing punctuation swallowed into links, a trailing period stops the replacement, IP/localhost/unknown-TLD and www links crash the process, protocol-relative links never call back, the whole text HTML-decoded, code spans replaced, HTML-escaped titles and URLs, a numeric template deletes the link, no timeout.
- everlast-setup: registered mode repo, sync push. AGENTS.md, CLAUDE.md (@AGENTS.md import) and .github/copilot-instructions.md added.
## [2026-09-26] index | rebuilt (1 entries)

## [2026-09-27] update | package.json restored
- 87e88c6 carried an unintended package.json change: `npm --prefix <scratch> init -y` ran in the repository because an earlier shell call had cd'd into it, and npm init normalised the file (git+ URL, bin object, directories, type). Restored from 6d43772. The tarball's package.json equals the original.

## [2026-09-27] add | Phase 1: plan and decision record
- ai-docs/plans/2026-09-27-modernization-and-v2-release.md (D1-D15, exceptions E1-E14) and ai-docs/decisions/2026-09-27-v2-promise-new-dependencies-named-exceptions.md (proposed). Checked 2026-09-27: tldts 7.4.15 (dep tldts-core), hogan.js 3.0.2 depends on nopt and mkdirp 0.3.0, url-regex GHSA-v4rh-8p82-6h5w covers <= 5.0.0 with no fix. Stop: waiting for Mark.
## [2026-09-26] index | rebuilt (3 entries)

## [2026-09-27] update | Plan ruled
- Mark: "Do all the recommendations and anything else you think will make the package easy to use and maintain and useful." Every recommendation stands (D1-D15, E1-E14); decision record accepted. Added A1 (CLI reads stdin) and A2 (README section on what it requests). Phase 2 starts on branch v2.

## [2026-09-27] add | Phase 2: rewrite, golden test, canary
- Branch v2: index.js, cli.js, lib/, jsconfig.json, .travis.yml, .vscode/ and the ava tests removed; infrastructure copied from stack-exchange-markdown-retriever (the closest finished run) and adapted. Runtime dependencies installed with `--min-release-age=0` on that one command: get-title-at-url 3.0.0, is-an-image-url 2.0.0 and replace-string-at-position 2.0.0 are younger than the three-day cooldown (the maintainer's own releases, D5); tldts 7.4.15.
- src/: scan-links.ts (url-regex 4.1.1's matches in linear time), find-links.ts (trim E4, code E7, contexts E8, http/https only), template.ts (mustache subset with hogan's output), source.ts (tldts), replace-plain-links.ts, index.ts, cli.ts.
- A scratch script ran every recorded case through the first build and listed the differences; every one matched a plan exception except three new ones, added to the plan as E15 (credentials: fetch refuses them), E16 (the Promise form) and E17 (a throwing callback is the caller's uncaught exception).
- Golden test: 305 pass, 4 skipped (the two callback-throws cases on each build, run in a child process by the functional suite). E1 is applied mechanically: each default-template "[Page](url)" gets the title get-title-at-url 3 reads from that url, and a custom template's "Page" likewise; the pages whose reading changed otherwise are named exceptions. Deviation from plan D1: the old titles come from the recording (every ordinary fixture page read as "Page"), not from article-title as a dev dependency (cheerio 0.22 would bring old dev-only alerts).
- Canary: first try with src/ untracked, so `git checkout -- src/` could not revert (both runs red; reverted by hand; skill lesson). After committing src (38fd6d4): `allowPrivateDomains: false` planted in src/source.ts, build, golden 303 pass 2 fail; `git checkout -- src/`, build, 305 pass 0 fail. check-golden-untouched.sh: 1.1.16.json, capture-1.1.16.cjs, codec.cjs, fixture-server.cjs unchanged since 87e88c6.
- Template oracle: test/unit/hogan/capture-hogan.cjs run in the scratch project with hogan.js 3.0.2 installed, 128 entries; the renderer matches all (hogan renders {{.}} and dotted names as nothing, found by the oracle).
- Scanner differential: 3000 generated texts against url-regex 4.1.1's expression written into the test, all equal; ten crafted 1 MB inputs each under 2 s.
- xo --fix on src removed `| null` from the public signatures (skill L-025 again); restored by hand with an override that gives the reason.

## [2026-09-27] add | Phase 2: verification
- npm run lint (cache cleared), typecheck: clean. publint all good; attw green in node10, node16-cjs, node16-esm, bundler. Tarball 11 files, 52 kB (budget 60 kB).
- npm run test:dist on Node 24.18: 400 tests, 396 pass, 4 skipped. Coverage 100 percent lines, branches and functions on every src file.
- npm run test:consumers: 8 pass, 5 skipped (Bun and Deno, CI only).
- npm run test:live (opt-in, real network): example.com gets "Example Domain", the Google logo PNG is left.
- actionlint 1.7.12 clean, check-workflow-shell.py clean, zizmor --offline no findings. check-readme-images.mjs: npm badges ok, the CI badge 404s until ci.yml is on master.
- Node 20.20.2, 22.23.3 and 26.10.0 (npx -p node@N): first Node 20 run failed 304 golden cases, because xo --fix had rewritten a test's `new Promise` into `Promise.withResolvers()` (Node 22+). Reverted; rule unicorn/prefer-promise-with-resolvers off with the reason. Then 396 pass, 4 skipped on each line.
- Fresh clone of v2 in the scratchpad: npm ci, lint, typecheck, npm test 396 pass, check clean.
- Lockfile: the single `npm install --min-release-age=0` of the four runtime dependencies had resolved the whole tree past the cooldown (35 locked versions younger than three days, 32 of them dev). Regenerated: npm install under the cooldown without the maintainer's three packages, then those three alone with --min-release-age=0; now only those three are younger than three days. `npm audit signatures` applies the cooldown to locked versions too, so ci.yml passes --min-release-age=0 to it (498 signatures, 127 attestations verified).

## [2026-09-27] add | Phase 2 end: pull request, CI
- Pushed v2; delete-branch-on-merge on. Pull request #12: https://github.com/m4bwav/markdown-plain-link-replacer/pull/12
- First CI run failed one job (package shape and coverage): the crafted input 'www.a.b-' x 125 000 took 3.8 s under c8 (bound 2 s): each www. start re-read the long host run up to the 256-character cap. Fixed in src/scan-links.ts: the labels are measured once, right to left (label end, top-level-domain letters, the last usable top-level domain along a chain of full labels), so each start is constant time, and the host length cap is gone (closer to url-regex). Three more crafted inputs added; 13 inputs about 200 ms each under c8. Differential (3000 texts) and golden still pass.
- CI run 36286840573: every job green (lint, package shape and coverage, Node 20/22/24/26 on Linux, Windows, macOS, Bun, Deno, ci).
- One local test:dist run right after a lint showed 8 failures that three later runs did not repeat (timing-sensitive tests under load; not identified). Watch for them in CI.
- Phase 3 review subagent running in the background (read-only).
## [2026-09-26] index | rebuilt (3 entries)
