/*
How 2.x behaves on the network, against the fixture server (test/golden/fixture-server.cjs) or an in-process stub: timeouts
(plan E11), aborts, the 100 ms spacing of title lookups, one lookup per URL, failures that leave the link, and a callback
that throws (plan E17), in a child process. No test reaches the internet.
*/
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import process from 'node:process';
import {
  after,
  before,
  describe,
  test,
} from 'node:test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {builds} from '../helpers/builds.js';
import {pageTitled, stubFetch} from '../helpers/stub-fetch.js';
import {installFetch} from '../helpers/web.js';

const load = createRequire(import.meta.url);
const fixtures = load('../golden/fixture-server.cjs');

let server;
let web;
const unexpected = [];
const onUncaught = error => {
  unexpected.push(`uncaught: ${error.message}`);
};

const onRejection = reason => {
  unexpected.push(`unhandled rejection: ${String(reason)}`);
};

before(async () => {
  server = await fixtures.start({});
  web = installFetch(server);
  process.on('uncaughtException', onUncaught);
  process.on('unhandledRejection', onRejection);
});
after(async () => {
  process.off('uncaughtException', onUncaught);
  process.off('unhandledRejection', onRejection);
  web.restore();
  await server.close();
});

const base = 'http://www.example.com';

function runChild(build, markdown) {
  const preload = pathToFileURL(fileURLToPath(new URL('../helpers/cli-preload.mjs', import.meta.url))).href;
  const script = fileURLToPath(new URL('../helpers/child-case.mjs', import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', preload, script, build, JSON.stringify(markdown)], {env: {...process.env, FIXTURE_BASE: server.base}});
    let stdout = '';
    child.stdout.on('data', data => {
      stdout += data;
    });
    child.on('error', reject);
    child.on('close', () => {
      resolve(JSON.parse(stdout));
    });
  });
}

for (const {name, lib} of builds) {
  describe(`network (${name})`, () => {
    test('a page that never answers leaves its link after the timeout; the others are replaced (E11)', async () => {
      const started = performance.now();
      const result = await lib.replacePlainLinks(`${base}/never and ${base}/page`, {timeout: 300});
      assert.equal(result, `${base}/never and "[Page /page](${base}/page)", *example.com*`);
      assert.ok(performance.now() - started < 3000);
    });

    test('the callback form takes a timeout too', async () => {
      const result = await new Promise(resolve => {
        lib.replacePlainLinks(`${base}/never`, resolve, undefined, {timeout: 200});
      });
      assert.equal(result, `${base}/never`);
    });

    test('an abort rejects the Promise with the signal\'s reason, and gives a callback the markdown unchanged', async () => {
      const reason = new Error('stop');
      const controller = new AbortController();
      const promise = lib.replacePlainLinks(`${base}/never and ${base}/page`, {signal: controller.signal});
      setTimeout(() => {
        controller.abort(reason);
      }, 100);
      await assert.rejects(promise, error => error === reason);

      const second = new AbortController();
      const unchanged = await new Promise(resolve => {
        lib.replacePlainLinks(`${base}/never`, resolve, undefined, {signal: second.signal});
        setTimeout(() => {
          second.abort();
        }, 100);
      });
      assert.equal(unchanged, `${base}/never`);
    });

    test('an already aborted signal rejects without a request', async () => {
      const seen = web.urls.length;
      const controller = new AbortController();
      controller.abort(new Error('already'));
      await assert.rejects(lib.replacePlainLinks(`${base}/page`, {signal: controller.signal}), /already/u);
      assert.equal(web.urls.length, seen);
    });

    test('a callback that throws: the exception is the caller\'s uncaught exception, and the callback runs once (E17)', async () => {
      for (const markdown of [`${base}/page`, 'no links']) {
        const result = await runChild(name, markdown);
        assert.deepEqual(result.calls, [markdown === 'no links' ? markdown : `"[Page /page](${base}/page)", *example.com*`]);
        assert.deepEqual(result.uncaught, ['thrown by the callback']);
        assert.deepEqual(result.rejections, []);
      }
    });

    test('failures leave the link: statuses, redirect loops, non-HTML, no title, images', async () => {
      const links = ['404', '500', '410', 'loop', 'json', 'notitle', 'empty-title', 'img'].map(path => `${base}/${path}`);
      const markdown = links.join('\n');
      assert.equal(await lib.replacePlainLinks(markdown), markdown);
    });

    test('no uncaught exception or unhandled rejection so far', () => {
      assert.deepEqual(unexpected, []);
    });
  });

  describe(`lookups (${name})`, () => {
    let fetchStub;
    const log = [];
    before(() => {
      web.restore();
      fetchStub = stubFetch(url => {
        log.push({url: url.href, at: performance.now()});
        return pageTitled('T');
      });
    });
    after(() => {
      fetchStub.restore();
      web = installFetch(server);
    });

    test('each URL is looked up once however often it appears: one image check, one title', async () => {
      log.length = 0;
      const text = `${base}/a ${base}/a (${base}/a) ${base}/a. ${base}/b`;
      const result = await lib.replacePlainLinks(text);
      const a = `"[T](${base}/a)", *example.com*`;
      assert.equal(result, `${a} ${a} (${a}) ${a}. "[T](${base}/b)", *example.com*`);
      assert.deepEqual(log.map(entry => entry.url).toSorted((left, right) => left.localeCompare(right)), [`${base}/a`, `${base}/a`, `${base}/b`, `${base}/b`]);
    });

    test('title lookups start 100 ms apart, as 1.1.16\'s did', async () => {
      log.length = 0;
      await lib.replacePlainLinks(`${base}/1 ${base}/2 ${base}/3 ${base}/4`);
      // The second request for each URL is its title lookup.
      const titles = ['1', '2', '3', '4'].map(id => log.filter(entry => entry.url === `${base}/${id}`)[1].at);
      // Each is scheduled index * 100 ms after the first, so a timer that fires late shortens only the gap after it.
      for (let index = 1; index < titles.length; index++) {
        assert.ok(titles[index] - titles[0] >= (index * 100) - 10, `lookup ${index + 1} came ${Math.round(titles[index] - titles[0])} ms after the first`);
      }
    });

    test('a fetch that throws leaves the link', async () => {
      fetchStub.answer = () => {
        throw new Error('network down');
      };

      try {
        assert.equal(await lib.replacePlainLinks(`${base}/x`), `${base}/x`);
      } finally {
        fetchStub.answer = url => {
          log.push({url: url.href, at: performance.now()});
          return pageTitled('T');
        };
      }
    });

    test('a replacement never changes the text around it, and a title holding a link is not replaced again', async () => {
      fetchStub.answer = url => pageTitled(url.pathname === '/one' ? `see ${base}/two` : 'Two');
      try {
        const result = await lib.replacePlainLinks(`x ${base}/one y ${base}/two z`);
        assert.equal(result, `x "[see ${base}/two](${base}/one)", *example.com* y "[Two](${base}/two)", *example.com* z`);
      } finally {
        fetchStub.answer = () => pageTitled('T');
      }
    });
  });
}
