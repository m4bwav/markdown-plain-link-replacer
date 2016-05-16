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
  var sampleInput = fs.readFileSync('./fixtures/wikialistsample.md');
  var targetOutput = fs.readFileSync('./fixtures/wikialistsample-output.md');

  linkReplacer.replacePlainLinks(sampleInput, function (newMarkdown) {
    t.is(newMarkdown, targetOutput);
    t.end();
  });
});
