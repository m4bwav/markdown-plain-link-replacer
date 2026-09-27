/*
{{source}}: the registrable domain (Public Suffix List, private suffixes included), as parse-domain 0.2.1 named it for 1.1.16,
and the host name where there is none (plan E2; 1.1.16 crashed there). Checked through replacePlainLinks with a stub page.
*/
import assert from 'node:assert/strict';
import {
  after,
  before,
  describe,
  test,
} from 'node:test';
import {builds} from '../helpers/builds.js';
import {pageTitled, stubFetch} from '../helpers/stub-fetch.js';

let fetchStub;
before(() => {
  fetchStub = stubFetch(() => pageTitled('T'));
});
after(() => {
  fetchStub.restore();
});

const cases = [
  // [link, source]; the first group is what parse-domain 0.2.1 gave in the golden capture.
  ['http://www.example.com/p', 'example.com'],
  ['http://example.org/p', 'example.org'],
  ['http://a.b.example.com/p', 'example.com'],
  ['http://www.example.co.uk/p', 'example.co.uk'],
  ['https://someone.github.io/p', 'someone.github.io'],
  ['http://starwars.wikia.com/wiki/Bespin', 'wikia.com'],
  ['https://en.wikipedia.org/wiki/Bent_(band)', 'wikipedia.org'],
  ['http://café.example.com/p', 'example.com'],
  ['http://xn--caf-dma.example.com/p', 'example.com'],
  ['http://www.example.com:8080/p', 'example.com'],
  ['HTTP://WWW.EXAMPLE.COM/P', 'example.com'],
  // Where 1.1.16 crashed.
  ['http://192.0.2.10/p', '192.0.2.10'],
  ['http://localhost/p', 'localhost'],
  ['http://localhost:3000/p', 'localhost'],
  ['http://www.example.notatld/p', 'example.notatld'],
  // More public suffixes.
  ['https://docs.aws.amazon.com/p', 'amazon.com'],
  ['https://user.blogspot.com/p', 'user.blogspot.com'],
  ['https://www.gov.uk/p', 'www.gov.uk'],
  ['https://a.b.c.example.com.au/p', 'example.com.au'],
];

for (const {name, lib} of builds) {
  describe(`source (${name})`, () => {
    test('the site named for each host', async () => {
      for (const [link, source] of cases) {
        assert.equal(await lib.replacePlainLinks(link, {template: '{{{source}}}'}), source, link);
      }
    });
  });
}
