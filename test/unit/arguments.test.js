/*
The two call forms and every argument check (plan D6, D7): what throws a TypeError before any request, what a falsy markdown
gets, when the callback runs, and what the Promise resolves to.
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
  fetchStub = stubFetch(() => pageTitled('Title'));
});
after(() => {
  fetchStub.restore();
});

const LINK = 'http://www.example.com/p';
const REPLACED = '"[Title](http://www.example.com/p)", *example.com*';

for (const {name, lib} of builds) {
  describe(`arguments (${name})`, () => {
    test('the exports', () => {
      assert.equal(typeof lib.replacePlainLinks, 'function');
      assert.equal(lib.default.replacePlainLinks, lib.replacePlainLinks);
      assert.equal(lib.replacePlainLinks.name, 'replacePlainLinks');
    });

    test('markdown that is neither a string nor falsy throws a TypeError, in both forms', () => {
      for (const markdown of [42, true, {}, [LINK], Symbol('s'), () => LINK, 1n]) {
        assert.throws(() => lib.replacePlainLinks(markdown), TypeError);
        assert.throws(() => {
          lib.replacePlainLinks(markdown, () => {});
        }, TypeError);
      }
    });

    test('a String object is read as its string', async () => {
      assert.equal(await lib.replacePlainLinks(new String(LINK)), REPLACED);
    });

    test('a falsy markdown comes back as it is: at once to a callback, resolved by the Promise', async () => {
      for (const markdown of [undefined, null, '', 0, false, NaN]) {
        const calls = [];
        lib.replacePlainLinks(markdown, value => {
          calls.push(value);
        });
        assert.deepEqual(calls, [markdown]);

        assert.ok(Object.is(await lib.replacePlainLinks(markdown), markdown));
      }
    });

    test('the callback runs once, after the call returns, also for text without links', async () => {
      for (const markdown of [LINK, 'no links']) {
        let isReturned = false;

        const result = await new Promise(resolve => {
          const calls = [];
          lib.replacePlainLinks(markdown, value => {
            calls.push({value, afterReturn: isReturned});
            setTimeout(() => {
              resolve(calls);
            }, 50);
          });
          isReturned = true;
        });
        assert.deepEqual(result, [{value: markdown === LINK ? REPLACED : markdown, afterReturn: true}]);
      }
    });

    test('the second argument: a callback, an options object, null or undefined; anything else throws', () => {
      for (const second of ['cb', 42, true, Symbol('s')]) {
        assert.throws(() => lib.replacePlainLinks(LINK, second), TypeError);
      }

      for (const second of [undefined, null, {}]) {
        const result = lib.replacePlainLinks(LINK, second);
        assert.ok(result instanceof Promise);
      }
    });

    test('timeout must be a positive number; signal an AbortSignal', () => {
      for (const timeout of [0, -1, NaN, '100', null, true]) {
        assert.throws(() => lib.replacePlainLinks(LINK, {timeout}), TypeError, String(timeout));
        assert.throws(() => {
          lib.replacePlainLinks(LINK, () => {}, undefined, {timeout});
        }, TypeError);
      }

      for (const signal of [null, {}, 'signal', 1]) {
        assert.throws(() => lib.replacePlainLinks(LINK, {signal}), TypeError);
      }

      assert.throws(() => lib.replacePlainLinks(LINK, () => {}, undefined, 'options'), TypeError);
    });

    test('argument errors come before any request', () => {
      const seen = fetchStub.urls.length;
      assert.throws(() => lib.replacePlainLinks(LINK, {template: '{{#x}}'}), TypeError);
      assert.throws(() => lib.replacePlainLinks(LINK, {timeout: -5}), TypeError);
      assert.equal(fetchStub.urls.length, seen);
    });

    test('a huge timeout is accepted (capped at the timer maximum)', async () => {
      assert.equal(await lib.replacePlainLinks(LINK, {timeout: Number.MAX_SAFE_INTEGER}), REPLACED);
      assert.equal(await lib.replacePlainLinks(LINK, {timeout: Infinity}), REPLACED);
    });
  });
}
