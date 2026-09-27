/*
Which links 2.x finds, through replacePlainLinks with a fetch that answers every URL as an image (so nothing is replaced and
no title is looked up): the URLs it asks for are exactly the links it found.

1. Differential: on generated text, the links must be url-regex 4.1.1's matches (its strict expression is written out below as
   the oracle, with ip-regex 1.0.3's IPv4 part, as 1.1.16 installed them), trimmed as plan E4 says, http and https only.
2. The contexts that are left alone (plan E3, E7, E8).
3. Crafted input that made url-regex backtrack for minutes is scanned in linear time.
*/
import assert from 'node:assert/strict';
import {
  after,
  before,
  describe,
  test,
} from 'node:test';
import {builds} from '../helpers/builds.js';
import {stubFetch} from '../helpers/stub-fetch.js';

const ipv4 = String.raw`(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){3}`;
const host = String.raw`(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)`;
const domain = String.raw`(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*`;
const tld = String.raw`(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?`;
const URL_REGEX_4 = new RegExp(String.raw`(?:(?:(?:[a-z]+:)?//)|www\.)(?:\S+(?::\S*)?@)?(?:localhost|${ipv4}|${host}${domain}${tld})(?::\d{2,5})?(?:[/?#][^\s"]*)?`, 'gi');

// Plan E4, restated from the plan rather than taken from the code: trailing . , ; : ! ? ' * ~ and backticks come off, and a
// closing ) ] } > when the link holds fewer of its opening bracket; never into the host name.
function trimmed(link) {
  let end = link.length;
  const minimum = link.indexOf('//') + 3;
  const pairs = new Map([[')', '('], [']', '['], ['}', '{'], ['>', '<']]);
  const count = (text, character) => text.split(character).length - 1;
  while (end > minimum) {
    const last = link[end - 1];
    const text = link.slice(0, end);
    if ('.,;:!?\'*~`'.includes(last) || (pairs.has(last) && count(text, pairs.get(last)) < count(text, last))) {
      end--;
    } else {
      break;
    }
  }

  return link.slice(0, end);
}

// 1.1.16's isUrlASmallerPartOfALargerUrl: a link followed by a character that is-url accepts after it (any but whitespace)
// is left alone, unless that character is `)`. E4 adds `"`, and a run of the punctuation and closing brackets it trims when
// whitespace, the end or `"` follows the run.
function isPartOfALargerUrl(rest) {
  return !/^(?:\)|[.,;:!?'*~`)\]}>]*(?:[\s"]|$))/u.test(rest);
}

function expectedUrls(text) {
  const urls = new Set();
  for (const {0: match, index} of text.matchAll(URL_REGEX_4)) {
    if (isPartOfALargerUrl(text.slice(index + match.length))) {
      continue;
    }

    const link = trimmed(match.trim());
    if (!/^https?:\/\//iu.test(link)) {
      continue;
    }

    let url;
    try {
      url = new URL(link);
    } catch {
      continue;
    }

    if (url.username || url.password) {
      continue;
    }

    url.hash = '';
    urls.add(url.href);
  }

  return [...urls].toSorted((a, b) => a.localeCompare(b));
}

// A small deterministic generator (mulberry32), so a failure can be replayed from its seed.
function random(seed) {
  let state = seed;
  return () => {
    state = Math.trunc(state + 0x6D_2B_79_F5);
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// Pieces of link-like text; none of them make a markdown context (no backtick, <, ], " or a character reference) or an image
// extension. `=`, `&`, `_`, `|`, `{`, `}`, `^`, one-digit ports and letters after a host test the larger-URL rule.
const PIECES = ['http', 'https', 'HTTP', 'ftp', '://', '//', 'www.', 'example', 'exa-mple', '.', '.com', '.co', '.uk', '.io', 'a', 'b1', '-', '@', 'user:pw@', ':', ':8080', ':1', ':8', '/', '/path', '?q=1', '#frag', ' ', ' ', ' ', '\n', 'localhost', '192.168.0.1', '10.0.0.256', 'café', 'x', '(', ')', ',', '.', '!', '?', '\'', '*', '~', ')', '　', '%20', '1', '2', '=', ' = ', '&', '_', '_v2', '|', '{', '}', '^', '.comx'];

function generate(next) {
  let text = '';
  const length = 3 + Math.floor(next() * 25);
  for (let index = 0; index < length; index++) {
    text += PIECES[Math.floor(next() * PIECES.length)];
  }

  return text;
}

let fetchStub;
before(() => {
  fetchStub = stubFetch(() => ({type: 'image/png', body: ''}));
});
after(() => {
  fetchStub.restore();
});

async function urlsFound(lib, text) {
  const from = fetchStub.urls.length;
  const result = await lib.replacePlainLinks(text);
  assert.equal(result, text, 'every link is an image, so nothing changes');
  return [...new Set(fetchStub.urls.slice(from))].toSorted((a, b) => a.localeCompare(b));
}

for (const {name, lib} of builds) {
  describe(`links found (${name})`, () => {
    test('the same links as url-regex 4.1.1 on 3000 generated texts', async () => {
      const next = random(20_260_927);
      for (let round = 0; round < 3000; round++) {
        const text = generate(next);

        assert.deepEqual(await urlsFound(lib, text), expectedUrls(text), `round ${round}: ${JSON.stringify(text)}`);
      }
    });

    test('the contexts left alone, and the ones replaced', async () => {
      const cases = [
        // [markdown, the URLs requested]
        ['[a](http://a.example.com/x)', []],
        ['![a](http://a.example.com/x)', []],
        ['[a](<http://a.example.com/x>)', []],
        ['<http://a.example.com/x>', []],
        ['[1]: http://a.example.com/x', []],
        ['  [long label]:\thttp://a.example.com/x', []],
        ['<a href="http://a.example.com/x">a</a>', []],
        ['<a href=\'http://a.example.com/x\'>a</a>', []],
        ['<img src=http://a.example.com/x>', []],
        ['"http://a.example.com/x"', []],
        ['`http://a.example.com/x`', []],
        ['``a ` http://a.example.com/x``', []],
        ['```js\nhttp://a.example.com/x\n```', []],
        ['~~~\nhttp://a.example.com/x\n~~~\nhttp://b.example.com/y', ['http://b.example.com/y']],
        ['```\nunclosed http://a.example.com/x', []],
        ['para\n\n    http://a.example.com/x', []],
        ['\thttp://a.example.com/x', []],
        ['- item\n\n    http://a.example.com/x', ['http://a.example.com/x']],
        ['para\n    http://a.example.com/x', ['http://a.example.com/x']],
        ['`code` http://a.example.com/x `more`', ['http://a.example.com/x']],
        ['a ` lone backtick http://a.example.com/x', ['http://a.example.com/x']],
        ['www.a.example.com/x', []],
        ['//a.example.com/x', []],
        ['ftp://a.example.com/x', []],
        ['mailto:a@example.com', []],
        ['http://user:pw@a.example.com/x', []],
        ['(see http://a.example.com/x).', ['http://a.example.com/x']],
        ['**http://a.example.com/x**', ['http://a.example.com/x']],
        ['~~http://a.example.com/x~~', ['http://a.example.com/x']],
        ['http://a.example.com/x?y=1&amp;z=2', ['http://a.example.com/x?y=1&z=2']],
        ['http://a.example.com/wiki/A_(b)', ['http://a.example.com/wiki/A_(b)']],
        ['http://a.example.com/{x}}', ['http://a.example.com/%7Bx%7D']],
        ['text [1]: http://a.example.com/x and http://b.example.com/y', ['http://b.example.com/y']],
        ['http://a.example.com/x\r\n[1]: http://b.example.com/y', ['http://a.example.com/x']],
        // Part of a larger URL the scanner cannot read whole: left alone, as 1.1.16 did (review bug 1).
        ['http://example.com_v2/docs', []],
        ['Server http://example.com:8/x', []],
        ['http://example.com:123456/x', []],
        ['See http://example.com, and http://example.org: then (http://example.net).', ['http://example.com/', 'http://example.net/', 'http://example.org/']],
        ['http://example.com|x and http://example.com^x and http://example.com}x', []],
        ['https://lists.example.org/archive?from=a@b.example.com&page=2 now', []],
        // An = outside a tag is prose, as in 1.1.16 (review bug 2); inside a tag it is an attribute.
        ['Mirror = http://a.example.com/x', ['http://a.example.com/x']],
        ['a=http://a.example.com/x b=http://b.example.com/y', ['http://a.example.com/x', 'http://b.example.com/y']],
        ['1 == http://a.example.com/x', ['http://a.example.com/x']],
        ['<a class="c" href = \'http://a.example.com/x\'>a</a>', []],
        ['<A HREF=http://a.example.com/x>a</A>', []],
      ];
      for (const [markdown, urls] of cases) {
        assert.deepEqual(await urlsFound(lib, markdown), urls, JSON.stringify(markdown));
      }
    });

    test('crafted input is scanned in linear time', async () => {
      const inputs = [
        `http://${'a'.repeat(1_000_000)}`,
        `www.${'a-'.repeat(500_000)}`,
        '//'.repeat(500_000),
        `http://${'a@'.repeat(500_000)}`,
        `http://${'a.'.repeat(500_000)}`,
        `http://x.co/${')'.repeat(1_000_000)}`,
        '`` ` '.repeat(200_000),
        'www.a.b-'.repeat(125_000),
        'www.'.repeat(250_000),
        `${'www.'.repeat(60)} `.repeat(4000),
        `http://${'a'.repeat(1_000_000)}.com`,
        'ftp://a.co/x '.repeat(10_000),
        '\n'.repeat(1_000_000),
        // With a link, so the code-span pass runs (review bug 3).
        `http://a.co/x ${'`a '.repeat(200_000)}`,
        `http://a.co/x ${'`a ``b '.repeat(100_000)}`,
      ];
      for (const input of inputs) {
        const started = performance.now();

        await urlsFound(lib, input);
        const elapsed = performance.now() - started;
        assert.ok(elapsed < 2000, `${JSON.stringify(input.slice(0, 20))}... took ${Math.round(elapsed)} ms`);
      }
    });
  });
}
