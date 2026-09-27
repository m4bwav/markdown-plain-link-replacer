// A TypeScript 5 consumer with an old CommonJS config: esModuleInterop off, node10 resolution. It type-checks the three import
// forms such projects write against the published declaration, then runs the compiled JavaScript (no request is made: the
// calls have no links or fail argument checks, which need no network).
import assert = require('node:assert/strict');
import linkReplacer = require('markdown-plain-link-replacer');
import * as namespace from 'markdown-plain-link-replacer';
import defaultImport, {replacePlainLinks as named} from 'markdown-plain-link-replacer';

async function main(): Promise<void> {
  const functions = [linkReplacer.replacePlainLinks, namespace.replacePlainLinks, defaultImport.replacePlainLinks, named];
  for (const replace of functions) {
    assert.equal(replace, linkReplacer.replacePlainLinks);
    assert.equal(await replace('no links here'), 'no links here');
    assert.throws(() => replace('x', {timeout: -1}), TypeError);
  }

  const calls: string[] = [];
  linkReplacer.replacePlainLinks('', markdown => {
    calls.push(markdown);
  });
  assert.deepEqual(calls, ['']);
  console.log('ts5-cjs-interop-off ok');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
