// A consumer written in CommonJS: require() of the installed package, used exactly as 1.1.16's README showed it (plan D2).
// Its argument is the base URL of the fixture server the runner started; fetch is replaced with one that sends every request
// there, naming the URL it meant.
'use strict';

const assert = require('node:assert/strict');
const process = require('node:process');
const linkReplacer = require('markdown-plain-link-replacer');
// Destructuring, the named-import habit in CommonJS.
const {replacePlainLinks} = require('markdown-plain-link-replacer');

const base = process.argv[2];
const realFetch = fetch;
globalThis.fetch = (input, init = {}) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const headers = new Headers(init.headers);
  headers.set('x-fixture-url', url.href);
  return realFetch(`${base}${url.pathname}${url.search}`, {...init, headers});
};

assert.match(require.resolve('markdown-plain-link-replacer'), /[/\\]dist[/\\]index\.cjs$/u, 'require resolves to the CommonJS build');
assert.equal(typeof linkReplacer.replacePlainLinks, 'function');
assert.equal(linkReplacer.default.replacePlainLinks, replacePlainLinks);

// The old README's call.
const input = '  http://starwars.wikia.com/wiki/Bespin  ';
linkReplacer.replacePlainLinks(input, newMarkdown => {
  assert.equal(newMarkdown, '  "[Page /wiki/Bespin](http://starwars.wikia.com/wiki/Bespin)", *wikia.com*  ');
  linkReplacer.replacePlainLinks('http://www.example.com/page', templated => {
    assert.equal(templated, '[Page /page](http://www.example.com/page) from example.com');
    console.log('cjs-node ok');
  }, '[{{title}}]({{url}}) from {{source}}');
});
