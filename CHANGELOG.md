# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses [Semantic Versioning](https://semver.org/).

## [2.0.0] - Unreleased

**The compatibility promise.** `require('markdown-plain-link-replacer').replacePlainLinks(markdown, callback, template)` finds the same links 1.1.16 found, looks up the same pages and writes the same text, with the same default template shape `"[title](url)", *source*`. The test suite checks this against 164 calls and 18 command-line runs recorded from the published 1.1.16 against a local test server, on both builds and every supported Node line. The exceptions are listed below. Most are crashes, answers that never came, or text 1.1.16 changed without meaning to: titles now come from get-title-at-url 3; trailing punctuation stays out of links; links in code, autolinks and reference definitions are left alone; the text is no longer HTML-decoded; the default template no longer HTML-escapes; hosts 1.1.16 could not name no longer crash the process; bad templates throw; each page has a timeout; the command line tool reads stdin and reports errors.

### Changed (breaking)

- Needs Node 20 or later. The package has an `exports` map, so deep imports such as `markdown-plain-link-replacer/lib/...` no longer resolve; import the package by its name.
- Titles come from [get-title-at-url](https://www.npmjs.com/package/get-title-at-url) 3 instead of article-title. A site name is removed only after a spaced separator (` | `, ` - `, ` – `, ` — `), so `Name: Site` and `Page /path` keep their whole text, and `<title>` wins over an `<h1>`. Character sets and gzip are decoded, line breaks in a title become spaces, any 2xx answer counts, and pages that are not HTML (`text/plain`, JSON) give no title.
- Trailing punctuation (`.`, `,`, `;`, `:`, `!`, `?`, a closing quote, `*`, `~`, a backtick) and a closing bracket the link did not open stay in the text after the replacement. 1.1.16 put them inside the link (`[Page](https://example.com/page,)`), and left a link followed by a period unreplaced.
- Links in code spans and code blocks, autolinks (`<https://…>`) and reference definitions with any spacing (`[1]:https://…`) are left as written. 1.1.16 replaced them.
- The text is no longer HTML-decoded: `&amp;`, `&lt;` and other entities outside the replaced links stay as written. A link's own `&amp;` is decoded for the request only.
- The default template writes the title and the URL without HTML escaping, and backslash-escapes `\`, `` ` ``, `*`, `_`, `[`, `]`, `<` and `>` in the title, so a title cannot break the link. Custom templates render as 1.1.16's hogan.js rendered them, except that `{{url}}` is the link as written rather than HTML-decoded.
- A template that is not a string (a number or an object deleted the link in 1.1.16), or that does not compile (an unclosed tag or section never called back), throws a `TypeError` at the call. Partials and delimiter changes are not supported.
- A markdown value that is neither a string nor falsy throws a `TypeError` with a new message (1.1.16 threw `html.replace is not a function`).
- Called without a callback, `replacePlainLinks` returns a Promise. 1.1.16 threw or left an unhandled rejection. A second argument that is neither a callback nor an options object throws a `TypeError`.
- An exception thrown by the callback is the caller's own uncaught exception, as it would be for any callback. 1.1.16 turned it into an unhandled Promise rejection.
- Links with a user name or password (`http://user:pass@…`) are left alone: `fetch` refuses them. 1.1.16 requested them.
- The command line tool reads the markdown from stdin when it has no argument (or `-`); an empty stdin prints an empty line. A missing input file, a bad flag or a bad template prints an error to stderr and exits 1; 1.1.16 printed `undefined` with exit 0, or a stack trace. `-h` prints the help (1.1.16 printed nothing).

### Fixed

- Links to an IP address, `localhost` or a host with an unknown top-level domain are replaced, with the host name as the source. 1.1.16 crashed the process with a `TypeError` from parse-domain.
- `www.example.com` and `//example.com` without a scheme are left as written. 1.1.16 crashed the process, or never called back.
- A page that never answers leaves its link after the timeout (10 seconds by default). 1.1.16's title lookup waited for ever, so the callback never came.
- Links with non-ASCII characters in the path are looked up. 1.1.16's request refused them.
- Link scanning takes linear time. 1.1.16 used url-regex 4, whose expression can backtrack for minutes on crafted text (GHSA-v4rh-8p82-6h5w, no fixed version).
- A link that appears several times is looked up once. 1.1.16 checked each occurrence for an image.

### Added

- A Promise form: `await replacePlainLinks(markdown, {template, timeout, signal})`.
- `timeout` and `signal` options (the callback form takes them as a fourth argument).
- TypeScript types, and ES module and CommonJS builds.
- The command line tool's `--timeout <ms>`, `--version`, and stdin input (`cat notes.md | markdown-plain-link-replacer`).

### Removed

- Twelve runtime dependencies, among them `request` (deprecated), `bluebird`, `meow` 3, `hogan.js`, `he`, `url-regex` and `parse-domain` 0.2.1. 2.0.0 depends on get-title-at-url, is-an-image-url, replace-string-at-position and tldts.

## [1.1.16] - 2018-04-28

The last 1.x release: `replacePlainLinks(markdown, callback, template)` on request, url-regex, hogan.js and parse-domain, and a meow 3 command line tool.

[2.0.0]: https://github.com/m4bwav/markdown-plain-link-replacer/compare/v1.1.16...v2.0.0
[1.1.16]: https://www.npmjs.com/package/markdown-plain-link-replacer/v/1.1.16
