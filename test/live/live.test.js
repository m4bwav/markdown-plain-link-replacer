/*
Live smoke test against real pages: example.com (IANA's reserved example page, whose title has been "Example Domain" for many
years) and an image. Opt-in: it runs under `npm run test:live` or with LIVE_TESTS=1, never in `npm test`, because real pages
change and networks fail. live.yml runs it weekly.
*/
import assert from 'node:assert/strict';
import process from 'node:process';
import {test} from 'node:test';
import {replacePlainLinks} from '../../dist/index.mjs';

const isEnabled = process.env.LIVE_TESTS === '1' || process.env.npm_lifecycle_event === 'test:live';
const skip = isEnabled ? false : 'live tests are opt-in: npm run test:live, or LIVE_TESTS=1';

test('live: example.com gets its title', {skip}, async () => {
  const result = await replacePlainLinks('See https://example.com/.', {timeout: 20_000});
  assert.equal(result, 'See "[Example Domain](https://example.com/)", *example.com*.');
});

test('live: an image link is left alone', {skip}, async () => {
  const link = 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png';
  assert.equal(await replacePlainLinks(link, {timeout: 20_000}), link);
});
