// A consumer written as an ES module, run by Node, Bun or Deno with the fixture server's address as its argument. It replaces
// fetch with one that sends every request there, naming the URL it meant, through this runtime's own fetch.
import assert from 'node:assert/strict';
import process from 'node:process';
import linkReplacer, {replacePlainLinks} from 'markdown-plain-link-replacer';

const base = process.argv[2] ?? globalThis.Deno?.args[0];
const original = fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const headers = new Headers(init.headers);
  headers.set('x-fixture-url', url.href);
  return original(`${base}${url.pathname}${url.search}`, {...init, headers});
};

assert.equal(typeof replacePlainLinks, 'function');
assert.equal(linkReplacer.replacePlainLinks, replacePlainLinks, 'the default export holds the named export');
if (typeof import.meta.resolve === 'function' && !globalThis.Deno) {
  assert.match(import.meta.resolve('markdown-plain-link-replacer'), /\/dist\/index\.mjs$/u, 'import resolves to the ESM build');
}

const page = '"[Page /page](http://www.example.com/page)", *example.com*';
assert.equal(await replacePlainLinks('See http://www.example.com/page.'), `See ${page}.`);
assert.equal(await replacePlainLinks('http://www.example.com/page', {template: '[{{title}}]({{url}})'}), '[Page /page](http://www.example.com/page)');
assert.equal(await replacePlainLinks('an image http://www.example.com/img'), 'an image http://www.example.com/img');
assert.equal(await replacePlainLinks('`http://www.example.com/page`'), '`http://www.example.com/page`');
assert.equal(await replacePlainLinks('http://www.example.com/never', {timeout: 200}), 'http://www.example.com/never');
assert.throws(() => replacePlainLinks(42), TypeError);

let isReturned = false;
await new Promise(resolve => {
  linkReplacer.replacePlainLinks('http://www.example.com/page', markdown => {
    assert.ok(isReturned, 'the callback runs after replacePlainLinks returns');
    assert.equal(markdown, page);
    resolve();
  });
  isReturned = true;
});

console.log('esm-node ok');
