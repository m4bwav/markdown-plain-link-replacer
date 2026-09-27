/*
The compatibility promise (plan D1): for every case the published 1.1.16 was recorded on (test/golden/1.1.16.json, captured by
capture-1.1.16.cjs against fixture-server.cjs), 2.x, in both builds, answers the same: the same markdown, called back the same
way (at once for a falsy markdown, later otherwise), with no request 1.1.16 did not make, except the exceptions below. Each is
one plan item and one changelog line. Callback cases also run through the Promise form, which must resolve to the same text.

The golden file, the capture script, the fixture server and the codec are never edited (AGENTS.md).

Rules applied to every case:
- E1: 1.1.16 read each ordinary fixture page's title ("Page /<path>") as "Page" (article-title cut at the "/"); 2.x writes the
  title get-title-at-url 3 reads. `swapTitles` applies it: each default-template "[Page](<url>)" gets that url's title, markdown
  escaped (E6), and in a custom template each bare "Page" gets the one link's title.
- E10: argument errors throw the same class (TypeError), with 2.x's message.
The pages whose title reading changed otherwise are named exceptions with their expected output.
*/
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {
  after,
  before,
  describe,
  test,
} from 'node:test';
import {getTitleAtUrl} from 'get-title-at-url';
import {builds} from '../helpers/builds.js';
import {installFetch} from '../helpers/web.js';

const load = createRequire(import.meta.url);
const golden = load('./1.1.16.json');
const {encode, decode} = load('./codec.cjs');
const fixtures = load('./fixture-server.cjs');

let server;
let web;
before(async () => {
  server = await fixtures.start({});
  web = installFetch(server);
});
after(async () => {
  web.restore();
  await server.close();
});

// The default template's escaping of a title (E6).
const markdownEscape = title => title.replaceAll(/[*<>[\\\]_`]/gu, String.raw`\$&`).replaceAll(/&(?=#?\w+;)/gu, String.raw`\&`);

async function titleOf(url) {
  const result = await getTitleAtUrl(url);
  return result.title;
}

async function swapTitles(recorded, markdown, template) {
  if (typeof recorded !== 'string') {
    return recorded;
  }

  if ([undefined, null, ''].includes(template)) {
    let result = '';
    let last = 0;
    for (const match of recorded.matchAll(/"\[Page\]\((?<link>.+?)\)", \*/gu)) {
      const {link} = match.groups;
      const title = await titleOf(link.replaceAll('&amp;', '&'));
      result += `${recorded.slice(last, match.index)}"[${markdownEscape(title)}](${link})", *`;
      last = match.index + match[0].length;
    }

    return result + recorded.slice(last);
  }

  const [link] = /https?:\/\/\S+/u.exec(markdown) ?? [];
  if (!link || !recorded.includes('Page')) {
    return recorded;
  }

  const title = await titleOf(link);
  return recorded.replaceAll('Page', () => title);
}

const page = (url, title, source = 'example.com') => `"[${title}](${url})", *${source}*`;
const P = 'http://www.example.com/page';
const P2 = page(P, 'Page /page');

/*
Named exceptions: case name -> the plan item and what 2.x does instead. `output` is the expected markdown (for a callback
case, and the Promise form's result); `promise` means the call has no callback and returns a Promise of `output`; `threw`
is the class of a synchronous throw; `requests` lists the URLs 2.x requests where they differ from 1.1.16's; `skip` names
where a case is tested instead; `timeout` runs the case in the Promise form with that timeout.
*/
const exceptions = {
  // E16: without a callback, 2.x returns a Promise; 1.1.16 threw or left an unhandled rejection.
  'no arguments': {plan: 'E16', promise: true, output: undefined},
  'no callback, no links': {plan: 'E16', promise: true, output: 'plain text'},
  'no callback, a link': {plan: 'E16', promise: true, output: P2},
  'callback a string': {plan: 'E16', threw: 'TypeError'},
  'callback that throws': {plan: 'E17', skip: 'test/functional/replace-plain-links.test.js runs it in a child process: the exception is the caller\'s uncaught exception'},
  'callback that throws, no links': {plan: 'E17', skip: 'test/functional/replace-plain-links.test.js'},
  // E4: trailing punctuation stays in the text, after the link.
  'link followed by a period': {plan: 'E4', output: `See ${P2}.`},
  'link followed by three periods': {plan: 'E4', output: `See ${P2}...`},
  'link followed by a comma': {plan: 'E4', output: `See ${P2}, then more.`, requests: [P]},
  'link followed by a semicolon': {plan: 'E4', output: `See ${P2}; then more.`, requests: [P]},
  'link followed by a question mark': {plan: 'E4', output: `Have you seen ${P2}?`, requests: [P]},
  'link followed by an exclamation mark': {plan: 'E4', output: `Look: ${P2}!`, requests: [P]},
  'link in square brackets': {plan: 'E4', output: `[${P2}]`, requests: [P]},
  'link in single quotes': {plan: 'E4', output: `'${P2}'`, requests: [P]},
  'link with parentheses in the path, in parentheses': {
    plan: 'E4',
    output: `(${page('https://en.wikipedia.org/wiki/Bent_(band)', String.raw`Page /wiki/Bent\_(band)`, 'wikipedia.org')})`,
    requests: ['https://en.wikipedia.org/wiki/Bent_(band)'],
  },
  'a link and the same link with a period': {plan: 'E4', output: `${P2}. And ${P2}`},
  // E8: autolinks and reference definitions are left as written.
  'link in angle brackets (autolink)': {plan: 'E8', output: `<${P}>`, requests: []},
  'reference definition with two spaces': {plan: 'E8', output: `[1]:  ${P}`, requests: []},
  'reference definition without a space': {plan: 'E8', output: `[1]:${P}`, requests: []},
  // E7: code is left as written.
  'link in backticks (code span)': {plan: 'E7', output: `\`${P}\``, requests: []},
  'link in a fenced code block': {plan: 'E7', output: `\`\`\`\n${P}\n\`\`\``, requests: []},
  'link in an indented code block': {plan: 'E7', output: `Text\n\n    ${P}\n`, requests: []},
  // E5: the text is not HTML-decoded.
  'entities in the text, no links': {plan: 'E5', output: 'Tom &amp; Jerry &lt;3 &copy; &#169; &nbsp;.'},
  'entities in the text, with a link': {plan: 'E5', output: `A &amp; B ${P2}`},
  // E6: the default template writes the URL as written and the title without HTML escaping, markdown characters escaped.
  'link with a query string': {plan: 'E6', output: page(`${P}?a=1&b=2`, 'Page /page')},
  'title with HTML entities': {plan: 'E6', output: page('http://www.example.com/entities', String.raw`Tom & Jerry \<3 "quoted" 'single'`)},
  'title with markdown characters': {plan: 'E6', output: page('http://www.example.com/brackets', 'Array\\[0\\] (x) \\*star\\* \\_under\\_ \\`tick\\`')},
  'title with dollar patterns': {plan: 'E6', output: page('http://www.example.com/dollar', 'Cost $& $1 $$ $\'')},
  // E3: links without an http or https scheme are left, with no request and no crash.
  'protocol-relative link': {plan: 'E3', output: 'See //www.example.com/page here'},
  'www link without a scheme': {plan: 'E3', output: 'See www.example.com/page here'},
  // E2: hosts parse-domain 0.2.1 could not name are replaced, the source being the host name or tldts's domain.
  'IPv4 host': {plan: 'E2', output: page('http://192.0.2.10/page', 'Page /page', '192.0.2.10')},
  localhost: {plan: 'E2', output: page('http://localhost/page', 'Page /page', 'localhost')},
  'unknown TLD': {plan: 'E2', output: page('http://www.example.notatld/page', 'Page /page', 'example.notatld')},
  // E15: fetch refuses a URL with a user name or password, so the link is left and nothing is requested.
  'link with user info': {plan: 'E15', output: 'http://user:pass@www.example.com/page', requests: []},
  // E12: fetch requests non-ASCII paths (1.1.16's request refused them).
  'link with a non-ASCII path': {plan: 'E12', output: page('http://www.example.com/café', 'Page /café'), requests: ['http://www.example.com/caf%C3%A9']},
  'link with an emoji in the path': {plan: 'E12', output: page('http://www.example.com/😀', 'Page /😀'), requests: ['http://www.example.com/%F0%9F%98%80']},
  // E1: get-title-at-url 3 reads these pages' titles differently from article-title.
  'title with a colon': {plan: 'E1', output: page('http://www.example.com/colon', 'Site: Name After Colon')},
  'article heading beside the title': {plan: 'E1', output: page('http://www.example.com/heading', 'Doc Title')},
  'title with non-ASCII and an emoji': {plan: 'E1', output: page('http://www.example.com/unicode', 'Café')},
  'latin-1 page': {plan: 'E1', output: page('http://www.example.com/latin1', 'Café latin')},
  'title with line breaks': {plan: 'E1', output: page('http://www.example.com/newline', 'First line second line third')},
  'title that contains a link': {plan: 'E1', output: page('http://www.example.com/contains-url', 'See http://www.example.com/page for more')},
  'text/plain page': {plan: 'E1', output: 'http://www.example.com/plain'},
  'gzip page': {plan: 'E1', output: page('http://www.example.com/gzip', 'Gzipped Title')},
  'two title elements': {plan: 'E1', output: page('http://www.example.com/two-titles', 'First')},
  'title only inside svg': {plan: 'E1', output: 'http://www.example.com/svg-title'},
  'a 200 000-character text with one link': {plan: 'E1', output: summarise(`${'word '.repeat(40_000)}${P2}`)},
  // E10: templates 1.1.16 compiled to nothing or never finished are refused at the call.
  'template: unclosed tag': {plan: 'E10', threw: 'TypeError'},
  'template: unclosed section': {plan: 'E10', threw: 'TypeError'},
  'template: a number': {plan: 'E10', threw: 'TypeError'},
  'template: an object': {plan: 'E10', threw: 'TypeError'},
  // E11: a page that never answers leaves the link after the timeout (the default 10 s for each lookup; 300 ms here).
  'server never answers (no callback within 25 s)': {plan: 'E11', output: 'http://www.example.com/never', timeout: 300},
};

function summarise(value) {
  return typeof value === 'string' && value.length > 3000 ? {$long: value.length, start: value.slice(0, 120), end: value.slice(-120)} : value;
}

const isCallback = value => value && typeof value === 'object' && value.$callback === true;

// Runs one call; resolves with {threw} or {sync, output} (callback form) or {output} (Promise form), and the URLs requested.
async function run(lib, args, form, timeout) {
  const seen = web.urls.length;
  const real = decode(args);
  if (form === 'promise') {
    // The same call with the callback left out: replacePlainLinks(markdown, {template, timeout}).
    const options = {...(real[2] !== undefined && {template: real[2]}), ...(timeout !== undefined && {timeout})};
    real.splice(1, 3, Object.keys(options).length === 0 ? undefined : options);
  }

  let isReturned = false;
  const {promise: called, resolve: resolveCall} = Promise.withResolvers();
  const calls = [];
  const realArgs = real.map(value => (isCallback(value)
    ? (...callbackArgs) => {
      calls.push({sync: !isReturned, args: callbackArgs});
      resolveCall();
    }
    : value));
  let result;
  try {
    result = form === 'promise' ? lib.replacePlainLinks(...realArgs.slice(0, 2)) : lib.replacePlainLinks(...realArgs);
  } catch (error) {
    return {threw: error.name, urls: []};
  }

  isReturned = true;
  if (form === 'promise' || result !== undefined) {
    assert.ok(result instanceof Promise, 'a call without a callback returns a Promise');
    const output = await result;
    return {output: encode(summarise(output)), urls: web.urls.slice(seen)};
  }

  await called;
  assert.equal(calls.length, 1, 'the callback is called once');
  return {sync: calls[0].sync, output: encode(summarise(calls[0].args[0])), urls: web.urls.slice(seen)};
}

const recordedUrls = record => [...new Set(record.requests.filter(line => / GET /u.test(line)).map(line => new URL(line.split(' ', 3)[2]).href))];

for (const {name: buildName, lib} of builds) {
  describe(`golden 1.1.16 (${buildName})`, () => {
    for (const record of golden.cases) {
      const exception = exceptions[record.name];
      const options = exception?.skip ? {skip: `${exception.plan}: ${exception.skip}`} : {};
      test(record.name, options, async () => {
        const [markdown, , template] = decode(record.args);
        let forms = isCallback(record.args[1]) && !exception?.promise ? ['callback', 'promise'] : [exception?.promise ? 'direct' : 'callback'];
        if (exception?.timeout) {
          forms = ['promise'];
        }

        for (const form of forms) {
          const got = await run(lib, record.args, form, exception?.timeout);
          // A named exception replaces the recorded answer, throw included.
          const threw = exception ? exception.threw : record.threw?.$error;
          if (threw) {
            assert.equal(got.threw, threw, `${form}: throws the same class`);
            continue;
          }

          assert.equal(got.threw, undefined, `${form}: ${got.threw} thrown`);
          const recordedCall = record.calls[0];
          const expected = encode(exception && 'output' in exception
            ? exception.output
            : await swapTitles(decode([recordedCall.args[0]])[0], markdown, template));
          assert.deepEqual(got.output, expected, `${form}: the markdown`);
          if (form === 'callback' && recordedCall) {
            assert.equal(got.sync, recordedCall.sync, 'called back at once only for a falsy markdown');
          }

          const allowed = new Set(exception?.requests ?? recordedUrls(record));
          for (const url of got.urls) {
            assert.ok(allowed.has(url), `${form}: requested ${url}, which 1.1.16 did not`);
          }
        }
      });
    }
  });
}

test('every named exception names a recorded case', () => {
  const names = new Set(golden.cases.map(record => record.name));
  for (const name of Object.keys(exceptions)) {
    assert.ok(names.has(name), name);
  }
});
