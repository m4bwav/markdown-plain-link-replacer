import fs from 'fs';
import test from 'ava';
import linkReplacer from './';

test.cb('Basic link replacement', function (t) {
  linkReplacer.replacePlainLinks('http://www.google.com', function (newMarkdown) {
    t.is(newMarkdown, '"[Google](http://www.google.com)", *google.com*');
    t.end();
  });
});

test.cb('Can handle a typical list of wikia urls at end of article', function (t) {
  fs.readFile('/fixtures/wikialistsample.md', function (inputErr, sampleInput) {
    fs.readFile('/fixtures/wikialistsample-output.md', function (outputErr, targetOutput) {
      linkReplacer.replacePlainLinks(sampleInput, function (newMarkdown) {
        t.is(newMarkdown, targetOutput);
        t.end();
      });
    });
  });
});
