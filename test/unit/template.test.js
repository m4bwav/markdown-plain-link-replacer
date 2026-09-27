/*
The template renderer against hogan.js 3.0.2, 1.1.16's engine: every entry in hogan/hogan-3.0.2.json (recorded from hogan.js
by hogan/capture-hogan.cjs) is rendered through replacePlainLinks, with a page whose title is the entry's title, and must give
hogan's output. Then what 2.x refuses (plan E10) and the default template (plan E6).
*/
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {after, before, describe, test} from 'node:test';
import {builds} from '../helpers/builds.js';
import {pageTitled, stubFetch} from '../helpers/stub-fetch.js';

const require = createRequire(import.meta.url);
const oracle = require('./hogan/hogan-3.0.2.json');

let fetchStub;
let title = '';
before(() => {
  fetchStub = stubFetch(() => pageTitled(title));
});
after(() => {
  fetchStub.restore();
});

for (const {name, lib} of builds) {
  describe(`templates (${name})`, () => {
    test(`every template matches ${oracle.engine}`, async () => {
      for (const entry of oracle.entries) {
        title = entry.values.title;
        const markdown = `before ${entry.values.url} after`;
        // An empty template means the default in replacePlainLinks, as in 1.1.16; hogan renders it as nothing.
        if (entry.template === '') {
          continue;
        }

        // eslint-disable-next-line no-await-in-loop -- the stub's title is shared, so one call at a time.
        const result = await lib.replacePlainLinks(markdown, {template: entry.template});
        assert.equal(result, `before ${entry.output} after`, `${JSON.stringify(entry.template)} with ${JSON.stringify(entry.values)}`);
      }
    });

    test('the callback form takes the template third, as 1.1.16 did', async () => {
      title = 'Page';
      const result = await new Promise(resolve => {
        lib.replacePlainLinks('http://www.example.com/page', resolve, '[{{title}}]({{url}}) from {{source}}');
      });
      assert.equal(result, '[Page](http://www.example.com/page) from example.com');
    });

    test('a template given third with no callback is used', async () => {
      title = 'Page';
      assert.equal(await lib.replacePlainLinks('http://www.example.com/page', undefined, '{{title}}'), 'Page');
    });

    test('empty, null and undefined templates mean the default', async () => {
      title = 'Page';
      for (const template of ['', null, undefined]) {
        // eslint-disable-next-line no-await-in-loop -- sequential on purpose.
        assert.equal(await lib.replacePlainLinks('http://www.example.com/page', {template}), '"[Page](http://www.example.com/page)", *example.com*');
      }
    });

    test('the default template escapes markdown in the title, not HTML (E6)', async () => {
      title = 'A [b] *c* _d_ `e` <f> \\g & h &amp; i';
      assert.equal(
        await lib.replacePlainLinks('http://www.example.com/page?x=1&y=2'),
        '"[A \\[b\\] \\*c\\* \\_d\\_ \\`e\\` \\<f\\> \\\\g & h \\&amp; i](http://www.example.com/page?x=1&y=2)", *example.com*',
      );
    });

    test('unsupported or unclosed templates throw a TypeError before any request (E10)', () => {
      const before = fetchStub.urls.length;
      for (const template of ['{{> partial}}', '{{=<% %>=}}', '{{<parent}}{{/parent}}', '{{$block}}{{/block}}', '{{title', '{{{title}}', '{{#title}}', '{{/title}}', '{{#title}}{{/url}}', 42, {}, [], true]) {
        assert.throws(() => lib.replacePlainLinks('http://www.example.com/page', {template}), TypeError, JSON.stringify(template));
        assert.throws(() => {
          lib.replacePlainLinks('http://www.example.com/page', () => {}, template);
        }, TypeError, JSON.stringify(template));
      }

      assert.equal(fetchStub.urls.length, before);
    });
  });
}
