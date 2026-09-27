# AGENTS.md

Rules for any AI agent (Claude Code, Copilot, Cursor, Codex) working in this repository. `CLAUDE.md` and `.github/copilot-instructions.md` only point here.

## What this is

The npm package `markdown-plain-link-replacer`: finds plain links in a markdown text, looks up each page's title, and replaces the link with a titled markdown link (`"[Title](url)", *source*` by default, or a hogan.js template), with a command line tool. On npm since 2016; 1.1.16 (2018-04-28, CommonJS in `index.js`, `lib/` and a meow 3 CLI, twelve runtime dependencies, no build) is the published version until 2.0.0 ships. Version 2 is TypeScript in `src/`, built by tsdown into ESM and CommonJS with a declaration file for each, on four runtime dependencies: get-title-at-url, is-an-image-url and replace-string-at-position (the maintainer's own) and tldts. The plan is `ai-docs/plans/2026-09-27-modernization-and-v2-release.md` (decisions D1-D15, exceptions E1-E17, additions A1-A2); start with `ai-docs/HANDOFF.md` to see how far it has got.

## Rules

- **Never change an answer 1.1.16 gave, except where the plan says so.** For every case in `test/golden/1.1.16.json`, 2.x returns the same markdown, makes the same page lookups and fails the same way as the published 1.1.16, except the exceptions the plan names, each listed once in the golden test with its changelog line. The golden file was captured from the published 1.1.16 by `test/golden/capture-1.1.16.cjs` against `fixture-server.cjs`, with `codec.cjs`, in a scratch project. Never regenerate it from this repository, and never edit the golden JSON, the capture script, the fixture server or the codec (`scripts/check-golden-untouched.sh` in the package-modernize skill checks it). A fix that changes an old result needs a decision entry in `ai-docs/decisions/` and a changelog line.
- **No test touches the internet.** Every page a test links to is served by `test/golden/fixture-server.cjs` on 127.0.0.1; the capture also refused any socket that was not to 127.0.0.1. `npm test` never touches the network.
- **Availability.** The package must stay usable from `import` and `require`, ship types for both, and support every Node line in `engines`. No runtime dependency without a decision entry in `ai-docs/decisions/`.
- **Tests cover every artifact, not just the code.** Golden, unit, functional, CLI, package shape (`publint`, `@arethetypeswrong/cli`), consumer fixtures for ESM, CJS and the type files, Bun and Deno, and post-publish verification from the registry. A behaviour change lands with its test.
- **Nothing reaches npm without the maintainer.** Never run `npm publish` or `npm stage publish` from a machine, never create or store an npm token, and never approve anything on npmjs.com. Releases go through `release.yml`, which only stages; the maintainer approves each version with 2FA.
- **Releases follow one ritual.**
  1. Update `CHANGELOG.md`. A release's heading carries its date; a prerelease uses the section of the release it leads to (`## [2.0.0] - Unreleased`, never a bare `## [Unreleased]`).
  2. Run the package-modernize skill's `scripts/preflight-tag-npm.sh VERSION <this repo>`; it prints READY with the two commands.
  3. Run `npm version <version>`, then `git push --follow-tags`.
  4. `release.yml` builds, tests and stages the npm publish through trusted publishing, and a separate job creates the GitHub Release.
  5. The maintainer approves the staged version on npmjs.com; then `scripts/verify-registry-npm.sh` runs the checks, `verify-published.yml` included.
- **Research beats recall.** Node, npm and tool versions change; the notes under `ai-docs/notes/` carry the date each fact was verified. Re-verify any version number older than three months before relying on it.
- **Document for handoff.** Anything learned, decided or built goes into `ai-docs/` (at minimum a line in `ai-docs/log.md`) before you finish. Rewrite `ai-docs/HANDOFF.md` when work is left unfinished. A fresh session in any tool must be able to continue from disk alone.
- **No AI attribution anywhere**: no Co-Authored-By trailers, no "generated with" lines in commits, pull requests or files.
- **Windows note.** Write files with an editor tool, not shell heredocs (they lose backslashes). Check line endings by counting byte 13 with node; Git Bash's grep cannot see carriage returns. The 1.1.16 tarball was published with CRLF files.

## Commands (version 2)

```bash
npm ci
npm run build          # tsdown -> dist/ (index.mjs, index.cjs, index.d.mts, index.d.cts, cli.mjs, maps)
npm test               # build, then node --test: golden, unit, functional, CLI, package shape (no network)
npm run test:dist      # the same suites against the dist/ already built
npm run test:consumers # build, pack, install the tarball into a scratch project, run the ESM, CJS, type and bin fixtures
npm run test:live      # opt-in: two real pages (example.com and an image)
npm run coverage       # c8 over the suites, mapped back to src/; fails under 95% lines or 90% branches
npm run lint           # xo
npm run typecheck      # tsc --noEmit
npm run check          # publint, attw --pack ., npm pack --dry-run (needs a build first)
```

tsdown needs Node 22.18+ or 24 to build; the built output and the tests run on Node 20 and up.

## Layout and traps

- `src/scan-links.ts` finds what url-regex 4.1.1 matched, in linear time (the regex itself can backtrack for minutes). `src/find-links.ts` trims trailing punctuation (plan E4), skips code (E7), existing links, autolinks, reference definitions and HTML attributes (E8), and keeps http and https only. `src/replace-plain-links.ts` is the pipeline: an image check per unique URL (is-an-image-url), then title lookups started 100 ms apart (get-title-at-url), then the replacements from the end of the text. `src/template.ts` is the mustache renderer (hogan.js 3.0.2's output for variables, sections and comments) and the default template; `src/source.ts` names the site with tldts. `src/index.ts` is both builds' entry; `src/cli.ts` the bin. Only `cli.ts` touches the process or the filesystem.
- Tests import `dist/`, never `src/`, and run against both builds (`test/helpers/builds.js`). Network tests go through `test/helpers/web.js` (every fetch to the fixture server, with the meant URL in `x-fixture-url`) or `test/helpers/stub-fetch.js` (in-process answers).
- `test/golden/golden.test.js` lists every exception to 1.1.16's recorded answers by case name, each with its plan item. A new difference is either a bug to fix in `src/` or a new plan item ruled by the maintainer; never edit the recording.
- `test/unit/hogan/hogan-3.0.2.json` holds hogan.js's answers for the template tests, recorded in a scratch project by `capture-hogan.cjs`.
- `xo --fix` rewrites code: it removed `| null` from the public signatures once (1.1.16 accepted a null template). Stage your work first and read the diff it makes to `src/`. A local `const require = createRequire(...)` trips import-x/order; name it `load`.
- The npm trusted publisher names `release.yml`, so renaming the file breaks publishing.

## everlast (session knowledge, load on demand)

- `ai-docs/INDEX.md` lists what past sessions learned here (solutions with verified commands, decisions with reasons, plans). At the start of a task, scan it and open only the entries whose title or tags match; no line matches: `everlast.py search "<key terms>"` before concluding nothing was recorded. Read `ai-docs/HANDOFF.md` when continuing unfinished work (everlast-resume skill).
- Before acting on an entry marked `(recheck due)`, run `everlast.py recheck <entry>`, re-run its Verified-by command only when that is read-only or safe (a build, a test, a version query), then record `everlast.py verify <entry>` or `verify <entry> --failed "what broke"`; a fix that changed is superseded, never reused blindly.
- Before finishing a task that hit a dead end, verified a non-obvious command, made a design choice, or taught you something about the user, record it (everlast-capture skill, or `everlast.py note` / `handoff`); rewrite `HANDOFF.md` when work is left unfinished. Say "nothing to record" when that is true.
- Anything naming a person, an internal host or name, a credential, or an opinion about people goes to the private sidecar (`--private`), never here. Lessons about the user or this machine go to the user tier (`--user`).
- Rules go in this file, system layout in CODEMAP.md; the doc set holds only what could not be re-derived from the code in a minute.
- Link documents together with relative markdown links: every markdown folder is reachable from an index whose lines say when to read each file (`ai-docs/INDEX.md` is generated from frontmatter; give entries a one-line `summary`), and an entry links the entries it relates to on a typed `Related:` line (`supersedes`, `contradicts`, `builds on`, `see also`). The set then reads as a graph for people in Obsidian and for agents alike. No wikilinks in the repo.
