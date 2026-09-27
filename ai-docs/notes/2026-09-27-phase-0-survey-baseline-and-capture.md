---
title: "Phase 0 survey: registry, repository, baseline, capture and security of 1.1.16"
kind: note
status: active
date: 2026-09-27
verified: 2026-09-27
stale_after: 2027-03-27
tags: [survey, baseline, v2, dead-services, tarball, golden, cli, network, security]
aliases: [survey, baseline, cli.js, meow, webhooks, capture, fixture server, url-regex, parse-domain]
summary: "read before the plan or the cleanup: what 1.1.16 is and ships, the old suite's result on Node 24, what the golden capture found (trailing punctuation swallowed into links, a trailing period stops the replacement, IP, localhost and unknown-TLD links crash the process, www links crash, protocol-relative links never call back, the whole text is HTML-decoded, code spans are replaced, HTML-escaped titles, no timeout), no dependents, the dead services with their webhook ids, and the raw survey-npm.sh and image-check output"
---

# Phase 0 survey: markdown-plain-link-replacer 1.1.16

## Summary

Surveyed 2026-09-27 (UTC) with the package-modernize skill's `survey-npm.sh`, a clone, the published tarball, the old suite in a scratch clone and a golden capture of the published version. Raw output is at the end.

### The package

- 1.1.16 of 2018-04-28 is latest; 38 versions from 2016-05-09. About 100 downloads a month (86 to 194 a month since April 2026). No `engines`, no `exports`, no types; `main: ./index.js`, `bin: cli.js`, a `files` allowlist (index.js, cli.js, lib). The registry counts 0 dependents, and a code search finds no package.json that names it outside this repository.
- One export: `{replacePlainLinks}`, a function of arity 3 `(markdown, callback, hoganTemplate)`, returning undefined. `require()` gives an object.
- Tarball: 9 files, 5070 bytes, equal to master apart from CRLF (index.js 31 and cli.js 42 carriage returns); package.json is identical.
- Twelve runtime dependencies. Four are the maintainer's own: get-title-at-url ^1.1.6 (3.0.0 current), is-an-image-url ^1.0.3 (2.0.0 current, 1.x deprecated), replace-string-at-position ^1.0.4 (2.0.0 current). Both get-title-at-url 1.1.8 and is-an-image-url 1.0.4 use the deprecated `request` 2.88.2. The others: array-iterate ^1.1.0 (2.0.1), bluebird ~3.5.0 (3.7.2), debug ^3.1.0 (4.4.3), he 1.1.1 (1.2.0), hogan.js 3.0.2 (current, unmaintained), is-url 1.2.4, meow 3.7.0 (14.1.0), parse-domain 0.2.1 (8.4.0), url-regex ^4.1.1 (5.0.0; ReDoS, the one open Dependabot alert, high). A fresh install is 171 packages with six deprecation warnings.

### Baseline (old suite, scratch clone, Node 24.18)

- `npm install --ignore-scripts`: 981 packages.
- `snyk test` needs a login (not run). xo 0.18 crashes: `TypeError: util.isDate is not a function`.
- ava 0.19 runs: 17 pass, 2 fail. Both failures compare against titles live pages had in 2018 (the Wikipedia Bent (band) page and the wikia sample). The old suite fetches codedread.com, google.com, wikipedia.org and wikia.com, so it can never be a stable baseline; the golden capture is the baseline.

### The published bin

meow 3.7.0 still works on Node 24: `--help` prints the help, `--version` 1.1.16, a link argument is replaced. No argument, a missing `-i` file and an unknown flag followed by the link all print `undefined` with exit 0. `-i` without a value exits 1 with ERR_INVALID_ARG_TYPE. `-h` prints nothing and exits 0.

### Golden capture (test/golden/1.1.16.json)

`capture-1.1.16.cjs` against `fixture-server.cjs`: 164 library cases and 18 CLI cases, run twice with byte-identical output (1 min 46 s each). `request` goes through HTTP_PROXY and HTTPS_PROXY to the fixture server, which answers http:// links as a proxy and https:// links through CONNECT and an in-process TLS server; a guard on `net.Socket.prototype.connect` refused any socket not to 127.0.0.1, and it never fired. Two cases made no request (a non-ASCII path, an emoji path): request refuses those URLs, and 1.1.16 leaves them as they are.

How 1.1.16 works, as recorded:

- Every link costs one GET by is-an-image-url (skipped when the path has an image extension) and then one GET by get-title-at-url; the title lookups start 100 ms apart. https links add a CONNECT each. A repeated link is looked up once and every valid occurrence is replaced.
- Falsy markdown (undefined, null, '', 0, false, NaN) calls back synchronously with the same value. A number, true, an object or an array throws `html.replace is not a function` synchronously. No arguments throws `callback is not a function`.
- The callback is called once, asynchronously, with the new text. A missing or non-function callback, or one that throws, becomes an unhandled rejection (bluebird), never a throw.

What it gets wrong (each a candidate plan decision):

1. **Trailing punctuation.** url-regex's path takes everything up to whitespace or a double quote, and only trailing dots are trimmed. `page,` `page;` `page?` `page!` become the link (`[Page](http://www.example.com/page,)`) and the punctuation disappears from the text. In square brackets, angle brackets, single quotes and backticks the closing character goes into the link (`page])`, `page&gt;)`, `page&#39;)`, ``page`)``).
2. **A trailing period stops the replacement.** `See http://www.example.com/page.` is left as it is: the parser trims the dot, and the validator then sees the link plus one character as a longer link and skips it. The same for `...`.
3. **Process crashes.** A link to an IPv4 address, `localhost` or a host with an unknown TLD makes parse-domain 0.2.1 return null, and `domainData.domain` throws inside a request callback: an uncaught TypeError that ends the process (the CLI exits 1). A `www.` link without a scheme makes get-title-at-url throw "Invalid url" inside a timer: the same. A protocol-relative `//host/path` link rejects with "Invalid URL" and the callback is never called.
4. **The whole text is HTML-decoded first** (`he.decode`): `&amp;`, `&lt;`, `&copy;` and `&nbsp;` in ordinary text change even when nothing is replaced.
5. **Code is not skipped.** Links in code spans, fenced and indented code blocks are replaced.
6. **Escaping.** The default template uses `{{title}}` and `{{url}}`, so hogan HTML-escapes both: a title `Tom & Jerry <3` is written `Tom &amp; Jerry &lt;3`, and a URL `?a=1&b=2` becomes `?a=1&amp;b=2`. Markdown characters in a title (`]`, `*`, `` ` ``) are not escaped and can break the link.
7. **Titles** come from article-title: cut at the first `|`, `-`, `/`, `•` or `—`, then after the first `:` (a title "See http://..." becomes "See http:"); an `article h1` of 6 to 99 characters wins over `<title>`; line breaks are removed without a space ("First linesecond line"); two `<title>` elements are joined. Latin-1 pages come out as mojibake; a gzip page gives no title (request does not decompress); a JSON page gives none; a text/plain page is parsed as HTML.
8. **Status.** Only a 200 gives a title; 404, 410, 500 and an empty or missing title leave the link. Redirects are followed (a loop costs 22 requests and leaves the link). An image content type is matched case-sensitively (`IMAGE/PNG` is not an image).
9. **Templates.** An empty, undefined or null template means the default. A number or an object compiles to an empty template, so the link is **deleted** from the text. A template with no `{{url}}` deletes the link too (by design). An unclosed section rejects: no callback.
10. **Already linked.** Only `](` right before the link and `]: ` (one space) before it count; `[1]:  url` (two spaces) and `[1]:url` are replaced, which breaks the reference definition. A link inside an HTML attribute or double quotes is left alone (by the longer-link check).
11. **No timeout.** is-an-image-url gives up after 20 s; get-title-at-url 1.1.8 has none, so a page that never answers means no callback at all.
12. **Source names** from parse-domain 0.2.1: `www.example.co.uk` gives example.co.uk, `someone.github.io` gives someone.github.io, a punycode or non-ASCII host gives example.com.

### Dead services, security and repository state

- Webhooks: Snyk 14564190 and 278463577, Travis 83047827. Files: `.travis.yml`, `.vscode/`, `jsconfig.json`. README badges: nodei.co, Travis, David, Coveralls, Snyk and Gitter are dead or dropped; the XO badge works (check-readme-images.mjs: 6 of 7 to fix).
- No token in history (`git log -p --all`) or in the scripts of any published version (the scripts never named a token).
- Pull requests: #4 to #11 open, all Snyk (#4, #5 meow; #6 to #11 get-title-at-url 1.1.8 to 2.0.0); #3 merged 2018; #1 (gitter badge) and #2 closed. Nine `snyk-fix-*` branches, one of them (`snyk-fix-a1249a24`) without an open pull request. No issues ever. One fork (gitter-badger, 2016, nothing to do).
- Settings: secret scanning, push protection and Dependabot security updates off; workflow permissions write; wiki and projects on; no ruleset; no workflows; no releases, 115 commits, tags v1.0.14 to v1.1.16.

## Raw output

```text
# npm survey: markdown-plain-link-replacer (2026-09-27T00:44Z)

## Registry metadata
$ npm view markdown-plain-link-replacer name version dist-tags time.created time.modified license author repository.url homepage main module types exports bin engines dependencies peerDependencies deprecated
name = 'markdown-plain-link-replacer'
version = '1.1.16'
dist-tags = { latest: '1.1.16' }
time.created = '2016-05-09T05:21:08.680Z'
time.modified = '2022-06-19T16:10:47.461Z'
license = 'MIT'
author = 'Mark Rogers'
repository.url = 'git+https://github.com/m4bwav/markdown-plain-link-replacer.git'
homepage = 'https://github.com/m4bwav/markdown-plain-link-replacer'
main = './index.js'
bin = { 'markdown-plain-link-replacer': 'cli.js' }
dependencies = {
  'array-iterate': '^1.1.0',
  bluebird: '~3.5.0',
  debug: '^3.1.0',
  'get-title-at-url': '^1.1.6',
  he: '1.1.1',
  'hogan.js': '3.0.2',
  'is-an-image-url': '^1.0.3',
  'is-url': '1.2.4',
  meow: '3.7.0',
  'parse-domain': '0.2.1',
  'replace-string-at-position': '^1.0.4',
  'url-regex': '^4.1.1'
}

## All published versions with dates
$ npm view markdown-plain-link-replacer time --json
{
  "modified": "2022-06-19T16:10:47.461Z",
  "created": "2016-05-09T05:21:08.680Z",
  "1.0.0": "2016-05-09T05:21:08.680Z",
  "1.0.2": "2016-05-09T05:25:37.658Z",
  "1.0.5": "2016-05-10T02:00:53.919Z",
  "1.0.6": "2016-05-10T02:04:45.747Z",
  "1.0.7": "2016-05-10T02:07:09.379Z",
  "1.0.8": "2016-05-10T02:14:16.051Z",
  "1.0.9": "2016-05-10T02:59:09.935Z",
  "1.0.10": "2016-05-10T03:02:37.722Z",
  "1.0.11": "2016-05-12T01:42:33.960Z",
  "1.0.12": "2016-05-12T01:59:02.865Z",
  "1.0.13": "2016-05-12T17:37:48.479Z",
  "1.0.14": "2016-05-12T17:55:52.401Z",
  "1.0.15": "2016-05-12T18:40:28.031Z",
  "1.0.16": "2016-05-13T18:09:16.903Z",
  "1.0.17": "2016-05-14T18:29:20.019Z",
  "1.0.18": "2016-05-14T23:28:32.978Z",
  "1.0.19": "2016-05-15T00:38:50.350Z",
  "1.0.20": "2016-05-15T00:41:12.871Z",
  "1.0.21": "2016-05-15T19:26:30.134Z",
  "1.0.22": "2016-05-16T03:22:05.024Z",
  "1.0.23": "2016-05-16T04:35:23.816Z",
  "1.0.24": "2016-05-18T05:01:12.532Z",
  "1.0.25": "2016-05-18T05:05:22.372Z",
  "1.0.26": "2016-05-19T00:12:08.042Z",
  "1.0.27": "2016-05-19T03:02:34.951Z",
  "1.1.0": "2016-05-20T03:18:15.325Z",
  "1.1.1": "2016-05-20T03:23:06.168Z",
  "1.1.2": "2016-05-20T03:36:59.614Z",
  "1.1.3": "2016-05-21T00:48:41.532Z",
  "1.1.4": "2016-05-21T00:51:19.389Z",
  "1.1.5": "2016-05-22T02:08:30.908Z",
  "1.1.6": "2016-05-22T02:14:45.857Z",
  "1.1.7": "2016-05-22T05:14:58.983Z",
  "1.1.8": "2016-07-29T14:45:46.637Z",
  "1.1.10": "2017-06-26T01:06:23.524Z",
  "1.1.11": "2017-06-26T01:14:42.332Z",
  "1.1.12": "2017-11-05T17:04:17.926Z",
  "1.1.14": "2018-04-28T15:09:43.927Z",
  "1.1.16": "2018-04-28T15:31:56.410Z"
}

## Attestations and signatures on the latest version
$ npm view markdown-plain-link-replacer dist.attestations dist.signatures --json
[
  {
    "keyid": "SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA",
    "sig": "MEUCIDLBr9tcHnOmfnT6Zt1EdqKmW1TQWbHS0+r8AK+bpDkbAiEAhwA0Lwe8SCYxMB/8sGfMvZEw/6QTpQuiwMpmJlvOYqI="
  }
]

## Maintainers (emails masked)
$ npm view markdown-plain-link-replacer maintainers --json | sed -E 's/ <[^>]*>/ <email>/'
[
  "markrogers <email>"
]

## Downloads, last month
$ curl -s https://api.npmjs.org/downloads/point/last-month/markdown-plain-link-replacer
{"downloads":103,"start":"2026-08-27","end":"2026-09-25","package":"markdown-plain-link-replacer"}
## Downloads, last year by month
$ curl -s "https://api.npmjs.org/downloads/range/last-year/markdown-plain-link-replacer" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m={};for(const {day,downloads} of JSON.parse(s).downloads){const k=day.slice(0,7);m[k]=(m[k]||0)+downloads}console.log(m)})'
{
  '2025-09': 1,
  '2025-10': 82,
  '2025-11': 6,
  '2025-12': 44,
  '2026-01': 4,
  '2026-02': 47,
  '2026-03': 47,
  '2026-04': 194,
  '2026-05': 126,
  '2026-06': 118,
  '2026-07': 132,
  '2026-08': 140,
  '2026-09': 86
}

## Dependents (registry search; npmjs.com shows the list)
$ curl -s "https://registry.npmjs.org/-/v1/search?text=markdown-plain-link-replacer&size=1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(JSON.stringify({total:r.total, first:r.objects[0]?.package?.name, dependents: r.objects[0]?.dependents ?? "(see https://www.npmjs.com/browse/depended/markdown-plain-link-replacer)"}))})'
{"total":2929047,"first":"markdown-plain-link-replacer","dependents":0}

## Dependents by name: public repositories whose package.json names it (the registry gives only a count)
$ gh search code "\"markdown-plain-link-replacer\"" --filename package.json --json repository --jq '.[].repository.nameWithOwner' --limit 50 2>&1 | sort -u
m4bwav/markdown-plain-link-replacer

## Tarball file list of the published version
$ npm pack markdown-plain-link-replacer --dry-run --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const [p]=JSON.parse(s);console.log(p.size+" bytes, "+p.entryCount+" files");for(const f of p.files)console.log(" "+f.path+" "+f.size)})'
5070 bytes, 9 files
 LICENSE 1099
 README.md 3010
 cli.js 1065
 index.js 1030
 lib/filter-valid-urls-and-lookup-titles.js 2547
 lib/markdown-webpage-url-validator.js 1595
 lib/parse-urls-from-markdown-and-filter.js 1881
 lib/replace-parsed-plain-links-with-titles.js 1935
 package.json 1695

## Runtime dependencies: how far behind
$ npm view <dep> version time.modified deprecated
array-iterate: wanted ^1.1.0, latest 2.0.1 (modified 2022-06-13)
bluebird: wanted ~3.5.0, latest 3.7.2 (modified 2026-06-29)
debug: wanted ^3.1.0, latest 4.4.3 (modified 2025-09-13)
get-title-at-url: wanted ^1.1.6, latest 3.0.0 (modified 2026-09-25)
he: wanted 1.1.1, latest 1.2.0 (modified 2022-07-06)
hogan.js: wanted 3.0.2, latest 3.0.2 (modified 2022-06-18)
is-an-image-url: wanted ^1.0.3, latest 2.0.0 (modified 2026-09-26)
is-url: wanted 1.2.4, latest 1.2.4 (modified 2023-04-08)
meow: wanted 3.7.0, latest 14.1.0 (modified 2026-02-20)
parse-domain: wanted 0.2.1, latest 8.4.0 (modified 2026-08-12)
replace-string-at-position: wanted ^1.0.4, latest 2.0.0 (modified 2026-09-26)
url-regex: wanted ^4.1.1, latest 5.0.0 (modified 2022-06-28)

# GitHub side (m4bwav/markdown-plain-link-replacer)
# GitHub survey: m4bwav/markdown-plain-link-replacer (2026-09-27T00:45Z)

## Repository
$ gh repo view m4bwav/markdown-plain-link-replacer --json name,description,defaultBranchRef,pushedAt,createdAt,licenseInfo,stargazerCount,forkCount,isArchived,homepageUrl --jq '{name,description,defaultBranch:.defaultBranchRef.name,pushedAt,createdAt,license:.licenseInfo.key,stars:.stargazerCount,forks:.forkCount,archived:.isArchived,homepage:.homepageUrl}'
{"archived":false,"createdAt":"2016-05-09T05:12:50Z","defaultBranch":"master","description":"Script to replace a plain text link (ie http://whatever) with a linked title to the link's webpage in markdown.","forks":1,"homepage":"https://www.npmjs.com/package/markdown-plain-link-replacer","license":"mit","name":"markdown-plain-link-replacer","pushedAt":"2026-02-15T15:57:47Z","stars":2}

## Settings and security features
$ gh api repos/m4bwav/markdown-plain-link-replacer --jq '{delete_branch_on_merge, has_wiki, has_projects, allow_squash_merge, web_commit_signoff_required, security_and_analysis}'
{"allow_squash_merge":true,"delete_branch_on_merge":false,"has_projects":true,"has_wiki":true,"security_and_analysis":{"dependabot_security_updates":{"status":"disabled"},"secret_scanning":{"status":"disabled"},"secret_scanning_non_provider_patterns":{"status":"disabled"},"secret_scanning_push_protection":{"status":"disabled"},"secret_scanning_validity_checks":{"status":"disabled"}},"web_commit_signoff_required":false}

## Default workflow permissions
$ gh api repos/m4bwav/markdown-plain-link-replacer/actions/permissions/workflow
{"default_workflow_permissions":"write","can_approve_pull_request_reviews":true}
## Branches
$ gh api repos/m4bwav/markdown-plain-link-replacer/branches --paginate --jq '.[].name'
master
snyk-fix-2dddfc9c070c4cc80d6e6da7c3adf8e2
snyk-fix-3e9166e706b06466e7a366b9a9f3ee80
snyk-fix-5d1fb1b6d18342fca2e02258ad0b1b62
snyk-fix-09d544de363b7f8439c79d1b05b9e8fe
snyk-fix-72cd3d6531d090e027159f94ebed3a58
snyk-fix-5405aa6ca6383b5b8930435c93858f74
snyk-fix-a9a652b395e3f09374fb637f7e4c2e42
snyk-fix-a1249a24
snyk-fix-bd150256bc1193865dff8f3052520f48

## Rulesets and branch protection
$ gh api repos/m4bwav/markdown-plain-link-replacer/rulesets --jq '.[] | "\(.id) \(.name) \(.enforcement)"'; gh api repos/m4bwav/markdown-plain-link-replacer/branches/$(gh repo view m4bwav/markdown-plain-link-replacer --json defaultBranchRef --jq .defaultBranchRef.name)/protection --jq . 2>/dev/null || echo '(no classic branch protection)'
{"message":"Branch not protected","documentation_url":"https://docs.github.com/rest/branches/branch-protection#get-branch-protection","status":"404"}(no classic branch protection)

## Issues (all states)
$ gh issue list -R m4bwav/markdown-plain-link-replacer --state all --limit 100 --json number,title,state,author,createdAt,closedAt --jq '.[] | "#\(.number) \(.state) \(.createdAt[:10]) \(.author.login): \(.title)"'

## Pull requests (all states)
$ gh pr list -R m4bwav/markdown-plain-link-replacer --state all --limit 100 --json number,title,state,author,headRefName,createdAt --jq '.[] | "#\(.number) \(.state) \(.createdAt[:10]) \(.author.login) [\(.headRefName)]: \(.title)"'
#11 OPEN 2026-02-15 m4bwav [snyk-fix-5d1fb1b6d18342fca2e02258ad0b1b62]: [Snyk] Security upgrade get-title-at-url from 1.1.8 to 2.0.0
#10 OPEN 2026-01-04 m4bwav [snyk-fix-09d544de363b7f8439c79d1b05b9e8fe]: [Snyk] Security upgrade get-title-at-url from 1.1.8 to 2.0.0
#9 OPEN 2025-07-27 m4bwav [snyk-fix-a9a652b395e3f09374fb637f7e4c2e42]: [Snyk] Security upgrade get-title-at-url from 1.1.8 to 2.0.0
#8 OPEN 2024-08-12 m4bwav [snyk-fix-3e9166e706b06466e7a366b9a9f3ee80]: [Snyk] Security upgrade get-title-at-url from 1.1.8 to 2.0.0
#7 OPEN 2023-11-25 m4bwav [snyk-fix-72cd3d6531d090e027159f94ebed3a58]: [Snyk] Security upgrade get-title-at-url from 1.1.8 to 2.0.0
#6 OPEN 2022-12-03 snyk-bot [snyk-fix-bd150256bc1193865dff8f3052520f48]: [Snyk] Security upgrade get-title-at-url from 1.1.8 to 2.0.0
#5 OPEN 2021-06-05 snyk-bot [snyk-fix-2dddfc9c070c4cc80d6e6da7c3adf8e2]: [Snyk] Security upgrade meow from 3.7.0 to 6.0.0
#4 OPEN 2021-03-27 snyk-bot [snyk-fix-5405aa6ca6383b5b8930435c93858f74]: [Snyk] Security upgrade meow from 3.7.0 to 8.0.0
#3 MERGED 2018-04-21 snyk-bot [snyk-fix-a1249a24]: [Snyk Update] New fixes for 1 vulnerable dependency path
#2 CLOSED 2017-09-30 snyk-bot [snyk-fix-9ea487ad]: [Snyk Update] New fixes for 1 vulnerable dependency path
#1 CLOSED 2016-05-14 gitter-badger [gitter-badge]: Add a Gitter chat badge to README.md

## Open Dependabot alerts by severity, package and scope
$ gh api "repos/m4bwav/markdown-plain-link-replacer/dependabot/alerts?state=open&per_page=100" --paginate --jq '.[] | "\(.security_advisory.severity) \(.dependency.package.name) \(.dependency.scope)"' | sort | uniq -c | sort -rn
      1 high url-regex runtime

## Open Dependabot alerts, count
$ gh api "repos/m4bwav/markdown-plain-link-replacer/dependabot/alerts?state=open&per_page=100" --paginate --jq length
1

## Webhooks (dead services leave these)
$ gh api repos/m4bwav/markdown-plain-link-replacer/hooks --jq '.[] | "\(.id) \(.config.url) active=\(.active) events=\(.events|join(","))"'
14564190 https://snyk.io/webhook/github active=true events=pull_request,push
83047827 https://notify.travis-ci.org active=true events=create,delete,issue_comment,member,public,pull_request,push,repository
278463577 https://snyk.io/webhook/github/147a83e9-7211-4f9d-afcc-dea4a41945f8 active=true events=pull_request,push

## Actions secrets (count) and variables
$ gh api repos/m4bwav/markdown-plain-link-replacer/actions/secrets --jq '{total_count, names:[.secrets[].name]}'; gh api repos/m4bwav/markdown-plain-link-replacer/actions/variables --jq '{total_count, names:[.variables[].name]}'
{"names":[],"total_count":0}
{"names":[],"total_count":0}

## Environments
$ gh api repos/m4bwav/markdown-plain-link-replacer/environments --jq '.environments[]? | "\(.name) reviewers=\([.protection_rules[]? | select(.type=="required_reviewers") | .reviewers[]?.reviewer.login] | join(","))"'

## Workflows
$ gh api repos/m4bwav/markdown-plain-link-replacer/actions/workflows --jq '.workflows[] | "\(.name) \(.path) \(.state)"'

## Action pins in the default branch's workflows, with each action's runtime
$ action_pins (git tree, contents API, action.yml at each ref)
(no workflow files)

## Forks
$ gh api repos/m4bwav/markdown-plain-link-replacer/forks --jq '.[] | "\(.full_name) pushed=\(.pushed_at[:10])"'
gitter-badger/markdown-plain-link-replacer pushed=2016-05-14

## Releases and tags
$ gh release list -R m4bwav/markdown-plain-link-replacer --limit 20; gh api repos/m4bwav/markdown-plain-link-replacer/tags --jq '.[].name' | head -30
v1.1.16
v1.1.14
v1.1.12
v1.1.11
v1.1.10
v1.1.9
v1.1.8
v1.1.7
v1.1.6
v1.1.5
v1.1.4
v1.1.3
v1.1.2
v1.1.1
v1.1.0
v1.0.28
v1.0.27
v1.0.26
v1.0.25
v1.0.24
v1.0.23
v1.0.22
v1.0.21
v1.0.20
v1.0.19
v1.0.18
v1.0.17
v1.0.16
v1.0.15
v1.0.14

## Dead-service files in the default branch
$ gh api repos/m4bwav/markdown-plain-link-replacer/git/trees/HEAD?recursive=1 --jq '.tree[].path' | grep -Ei '^(\.travis\.yml|\.snyk|\.synk|\.sonarcloud\.properties|sonar-project\.properties|\.coveralls\.yml|codecov\.yml|\.codecov\.yml|appveyor\.yml|\.circleci/|\.npmignore|\.nuspec|\.vscode/)' || echo '(none)'
.travis.yml
.vscode/launch.json
.vscode/settings.json

## Dotfiles at the root of the default branch
$ gh api repos/m4bwav/markdown-plain-link-replacer/contents --jq '.[].name' | grep '^\.' || echo '(none)'
.gitignore
.travis.yml
.vscode

## Branches with no open pull request (stale work or bot leftovers; each needs a disposition)
$ comm -23 <(gh api repos/m4bwav/markdown-plain-link-replacer/branches --paginate --jq '.[].name' | sort) <( (gh pr list -R m4bwav/markdown-plain-link-replacer --state open --limit 200 --json headRefName --jq '.[].headRefName'; gh repo view m4bwav/markdown-plain-link-replacer --json defaultBranchRef --jq .defaultBranchRef.name) | sort) || echo '(none)'
snyk-fix-a1249a24

## Badges in the README
$ gh api repos/m4bwav/markdown-plain-link-replacer/readme --jq .content | base64 -d 2>/dev/null | grep -Eo 'https?://[^ )]*(shields\.io|travis-ci|david-dm|snyk\.io|coveralls|codecov|gitter|sonarcloud|nodei\.co|badgen|badge)[^ )]*' | sort -u || echo '(none)'
https://badges.gitter.im/m4bwav/markdown-plain-link-replacer.svg
https://coveralls.io/github/m4bwav/markdown-plain-link-replacer?branch=master
https://david-dm.org/m4bwav/markdown-plain-link-replacer
https://david-dm.org/m4bwav/markdown-plain-link-replacer.svg
https://gitter.im/m4bwav/markdown-plain-link-replacer?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge
https://img.shields.io/badge/code_style-XO-5ed9c7.svg
https://img.shields.io/coveralls/m4bwav/markdown-plain-link-replacer/master.svg
https://img.shields.io/travis/m4bwav/markdown-plain-link-replacer/master.svg
https://nodei.co/npm/markdown-plain-link-replacer.png?downloads=true&downloadRank=true&stars=true
https://nodei.co/npm/markdown-plain-link-replacer/
https://snyk.io/test/github/m4bwav/markdown-plain-link-replacer
https://snyk.io/test/github/m4bwav/markdown-plain-link-replacer/badge.svg
https://travis-ci.org/m4bwav/markdown-plain-link-replacer

## Things only the maintainer can see
- Installed GitHub Apps and authorized OAuth apps: github.com/settings/installations and github.com/settings/applications (the API refuses the gh token).
- Whether a token in history is still live: revoke it at the provider regardless.

## Next: in the clone
- Read every source and test file, package.json, the build config, the README and every dotfile.
- Leaked credentials: .travis.yml, .npmrc, .env, workflows, and history (git log -S TOKEN_NAME).
- Run the old build and tests as they are (Windows: npm --script-shell "C:/Program Files/Git/bin/bash.exe" test for ./node_modules/.bin scripts).
- Then the golden capture from the PUBLISHED version in a scratch project (scripts/golden-capture-npm.template.cjs).

$ node scripts/check-readme-images.mjs README.md
7 image(s) in D:/m4bwa/Claude/Projects/Ai/markdown-plain-link-replacer/README.md, checked for npm
FIX  [npm package] https://nodei.co/npm/markdown-plain-link-replacer.png?downloads=true&downloadRank=true&stars=true
       - dead service (nodei.co (unmaintained)): replace with shields.io npm version and downloads badges
FIX  [Build Status] https://img.shields.io/travis/m4bwav/markdown-plain-link-replacer/master.svg
       - dead service (Travis CI): replace with the GitHub Actions badge: https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg
       - the badge itself says "not found"
FIX  [Dependency Status] https://david-dm.org/m4bwav/markdown-plain-link-replacer.svg
       - dead service (David (shut down)): replace with nothing; Dependabot covers dependency freshness
       - HTTP 500
FIX  [Coverage Status] https://img.shields.io/coveralls/m4bwav/markdown-plain-link-replacer/master.svg
       - dead service (Coveralls): replace with nothing, unless the plan keeps a coverage service
FIX  [Known Vulnerabilities] https://snyk.io/test/github/m4bwav/markdown-plain-link-replacer/badge.svg
       - dead service (Snyk): replace with nothing; Dependabot alerts and the registry audit in CI
ok   [XO code style] https://img.shields.io/badge/code_style-XO-5ed9c7.svg
FIX  [Gitter] https://badges.gitter.im/m4bwav/markdown-plain-link-replacer.svg
       - dead service (Gitter): replace with nothing, or a link to GitHub Discussions if it is switched on
6 image(s) to keep-replace-or-remove
```
