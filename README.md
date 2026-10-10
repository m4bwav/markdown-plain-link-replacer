# markdown-plain-link-replacer

![A quill pen drawing a chain across an old manuscript page beside a red wax seal](https://raw.githubusercontent.com/m4bwav/markdown-plain-link-replacer/master/.github/images/banner.jpg)

[![npm version](https://img.shields.io/npm/v/markdown-plain-link-replacer.svg)](https://www.npmjs.com/package/markdown-plain-link-replacer)
[![CI](https://github.com/m4bwav/markdown-plain-link-replacer/actions/workflows/ci.yml/badge.svg)](https://github.com/m4bwav/markdown-plain-link-replacer/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/markdown-plain-link-replacer.svg)](https://www.npmjs.com/package/markdown-plain-link-replacer)

Turn the bare links in a markdown text into titled links. Each page is requested, and its title and site replace the URL:

```text
Source: https://en.wikipedia.org/wiki/Bespin
```

becomes

```text
Source: "[Bespin](https://en.wikipedia.org/wiki/Bespin)", *wikipedia.org*
```

or whatever a [template](#templates) says. Links that are already markdown links, images, autolinks, reference definitions, HTML attributes or code are left alone, and so is any link whose page fails, times out or has no title. Nothing else in the text changes.

- A library and a command line tool, with TypeScript types, ES module and CommonJS builds.
- Node 20 and later, Bun and Deno.

## Install

```sh
npm install markdown-plain-link-replacer
```

## Usage

```js
import {replacePlainLinks} from 'markdown-plain-link-replacer';

const markdown = await replacePlainLinks('Source: https://en.wikipedia.org/wiki/Bespin');
// 'Source: "[Bespin](https://en.wikipedia.org/wiki/Bespin)", *wikipedia.org*'

const custom = await replacePlainLinks(text, {template: '[{{title}}]({{url}})', timeout: 5000});
```

**CommonJS**, with a callback, as in 1.x:

```js
const linkReplacer = require('markdown-plain-link-replacer');

linkReplacer.replacePlainLinks('  http://starwars.wikia.com/wiki/Bespin  ', newMarkdown => {
  console.log(newMarkdown);
}, '[{{title}}]({{url}}) from {{source}}');
```

## Command line

```sh
npm install --global markdown-plain-link-replacer

markdown-plain-link-replacer "Source: https://example.com"
markdown-plain-link-replacer -i notes.md > notes-linked.md
cat notes.md | markdown-plain-link-replacer -t "[{{title}}]({{url}})"
```

Or without installing: `npx markdown-plain-link-replacer -i notes.md`. The markdown comes from the first argument, from `-i <file>`, or from stdin (with no argument, or with `-`). The result goes to stdout. Options: `-i, --input <file>`, `-t, --template <text>`, `--timeout <ms>`, `-h, --help`, `-v, --version`. It exits 0 when it printed the markdown, and 1 with a message on stderr for bad arguments or an input it cannot read.

## API

### `replacePlainLinks(markdown, options?)`

Returns a Promise of the new markdown.

| Option | Type | Default | |
|---|---|---|---|
| `template` | string | `"[{{title}}]({{url}})", *{{source}}*` | The replacement for each link; see [Templates](#templates). |
| `timeout` | number | `10000` | Milliseconds to wait for each page, for the image check and for the title. |
| `signal` | AbortSignal | | Stops every lookup; the Promise rejects with the signal's reason. |

### `replacePlainLinks(markdown, callback, template?, options?)`

The 1.x form. Calls `callback(newMarkdown)` once, after returning. `template` is the template (or `undefined` for the default); `options` takes `timeout` and `signal`, and an abort gives the callback the markdown unchanged.

Both forms answer a falsy `markdown` (`''`, `null`, `undefined`) with the same value, at once to a callback. Both throw a `TypeError` before any request when `markdown` is neither a string nor falsy, the second argument is neither a callback nor an options object, the template is not a string or uses a mustache feature the renderer does not support, or `timeout` or `signal` has the wrong type. A lookup never throws or rejects: a link whose page cannot be read stays as it was.

The default export is `{replacePlainLinks}`, as `require()` returned in 1.x.

### Templates

A template is [mustache](https://mustache.github.io/mustache.5.html), rendered as hogan.js rendered it for 1.x, with three values:

| Value | |
|---|---|
| `{{title}}` | The page's title, as [get-title-at-url](https://www.npmjs.com/package/get-title-at-url) reads it (a site name after ` \| ` or ` - ` is removed). |
| `{{url}}` | The link as it is written in the markdown. |
| `{{source}}` | The site: the registrable domain (`www.example.co.uk` is `example.co.uk`, `someone.github.io` stays whole), or the host name for an IP address or `localhost`. |

`{{name}}` escapes HTML (`&`, `<`, `>`, `'`, `"`); `{{{name}}}` and `{{&name}}` do not. Sections `{{#title}}...{{/title}}`, inverted sections and comments work. Partials and delimiter changes do not, and throw a `TypeError`.

The default template writes the title without HTML escaping and escapes the characters that would break the link or format it: `\`, `` ` ``, `*`, `_`, `[`, `]`, `<` and `>`.

## Which links are replaced

A link is an `http://` or `https://` URL in the text. Punctuation that ends a sentence (`.`, `,`, `;`, `:`, `!`, `?`), a closing quote, `*` or `~` stays in the text after the link, and so does a closing bracket the link did not open: `(see https://example.com/a).` keeps both. `https://en.wikipedia.org/wiki/Bent_(band)` keeps its parenthesis.

These are left as they are, and never requested:

- the targets of markdown links and images, autolinks (`<https://…>`) and reference definitions (`[1]: https://…`);
- `href="https://…"` and other HTML attribute values, and a link followed by a double quote;
- links in code spans, fenced code blocks and indented code blocks;
- `www.example.com` and `//example.com` without a scheme, and other schemes (`ftp:`, `mailto:`);
- links with a user name or password.

A link whose path ends in an image extension is not requested; any other link gets one GET to see whether it is an image ([is-an-image-url](https://www.npmjs.com/package/is-an-image-url)), and then one GET for its title, started 100 ms after the previous link's so one site does not get every request at once. A link that appears several times is looked up once.

## What it requests, and what it is not

The package requests every http and https link it finds in the text it is given, from wherever it runs, including `localhost` and private addresses. Run it on text you trust, or in a place where those requests cannot reach anything that matters. It is not a markdown parser (it reads just enough to skip code and existing links), and it does not sanitise the titles it writes beyond the markdown escaping above.

## Migrating from 1.x

- `require('markdown-plain-link-replacer').replacePlainLinks(markdown, callback, template)` still works.
- Titles come from get-title-at-url 3 instead of article-title, so some titles differ (for example, `Name: Site` is no longer cut at the colon, and an `<h1>` no longer wins over `<title>`).
- 1.x crashed the process on links to IP addresses, `localhost` or `www.` without a scheme, and never called back for some inputs; 2.x replaces or leaves those links and always answers.
- 1.x HTML-decoded the whole text (`&amp;` became `&` everywhere) and replaced links inside code; 2.x does neither.
- 1.x swallowed trailing punctuation into the link, and left a link followed by a period unreplaced; 2.x keeps the punctuation in the text and replaces the link.
- The default template no longer HTML-escapes the title and the URL.
- A template that is not a string, or does not compile, throws a `TypeError` instead of deleting the link or never calling back.
- Each page gets a 10 second timeout (1.x waited forever for a title).
- The command line tool reads stdin, prints errors to stderr and exits 1 on them, and has `--timeout`.

The [changelog](CHANGELOG.md) lists every change.

## Package page

- npm: [markdown-plain-link-replacer](https://www.npmjs.com/package/markdown-plain-link-replacer)

## License

MIT © [Mark Rogers](https://www.markdavidrogers.com)
