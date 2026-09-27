/*
Runs one callback call in its own process, for the cases whose callback throws: the exception is an uncaught exception, which
node:test would report as a failure of whichever test is running. Loaded with `--import ./cli-preload.mjs` (FIXTURE_BASE set).
Usage: node --import cli-preload.mjs child-case.mjs <esm|cjs> '<markdown as JSON>'
Prints one JSON line: the callback's calls and the uncaught exceptions and unhandled rejections.
*/
import {createRequire} from 'node:module';
import process from 'node:process';

const [build, markdownJson] = process.argv.slice(2);
const lib = build === 'cjs' ? createRequire(import.meta.url)('../../dist/index.cjs') : await import('../../dist/index.mjs');
const calls = [];
const uncaught = [];
const rejections = [];
process.on('uncaughtException', error => {
  uncaught.push(error.message);
});
process.on('unhandledRejection', reason => {
  rejections.push(String(reason));
});

lib.replacePlainLinks(JSON.parse(markdownJson), markdown => {
  calls.push(markdown);
  throw new Error('thrown by the callback');
});

setTimeout(() => {
  process.stdout.write(`${JSON.stringify({calls, uncaught, rejections})}\n`);
}, 1000);
