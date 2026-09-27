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
