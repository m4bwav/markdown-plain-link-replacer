import fs from 'fs';
import test from 'ava';
import linkReplacer from './';

var basicInput = 'http://www.google.com';
var testImageUrl = 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png';
var basicOutput = '"[Google](' + basicInput + ')", *google.com*';
var fourSpaces = '    ';
var endOfFileReference = '[1]: http://en.wikipedia.org/wiki/Branch_predictor';
test.cb('Basic link replacement', function (t) {
  linkReplacer.replacePlainLinks(basicInput, function (newMarkdown) {
    t.is(newMarkdown, basicOutput);
    t.end();
  });
});

test.cb('Basic link replacement in parentheses', function (t) {
  linkReplacer.replacePlainLinks('(' + basicInput + ')', function (newMarkdown) {
    t.is(newMarkdown, '(' + basicOutput + ')');
    t.end();
  });
});

test.cb('Basic link replacement with trailing spaces', function (t) {
  linkReplacer.replacePlainLinks(basicInput + fourSpaces, function (newMarkdown) {
    t.is(newMarkdown, basicOutput + fourSpaces);
    t.end();
  });
});

test.cb('A link that is part of existing markdown link should not be replaced', function (t) {
  linkReplacer.replacePlainLinks(basicOutput, function (newMarkdown) {
    t.is(newMarkdown, basicOutput);
    t.end();
  });
});

test.cb('A link that is part of the reference list at the end of markdown, should not be replaced', function (t) {
  linkReplacer.replacePlainLinks(endOfFileReference, function (newMarkdown) {
    t.is(newMarkdown, endOfFileReference);
    t.end();
  });
});

test.cb('Only links that are not part of existing links should be textified, even if there is another link with the same url', function (t) {
  linkReplacer.replacePlainLinks(basicOutput + ' ' + basicInput, function (newMarkdown) {
    t.is(newMarkdown, basicOutput + ' ' + basicOutput);
    t.end();
  });
});

test.cb('Will not replace image links', function (t) {
  linkReplacer.replacePlainLinks(testImageUrl, function (newMarkdown) {
    t.is(newMarkdown, testImageUrl);
    t.end();
  });
});

test.cb('Basic link replacement with the same link appearing twice', function (t) {
  linkReplacer.replacePlainLinks(basicInput + ' ' + basicInput, function (newMarkdown) {
    t.is(newMarkdown, basicOutput + ' ' + basicOutput);
    t.end();
  });
});

test.cb('A 404 title shouldn\t be replaced', function (t) {
  var fourOhFourUrl = 'http://www.google.com/aaa';
  linkReplacer.replacePlainLinks(fourOhFourUrl, function (newMarkdown) {
    t.is(newMarkdown, fourOhFourUrl);
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
