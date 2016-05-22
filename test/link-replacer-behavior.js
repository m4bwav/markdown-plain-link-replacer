import fs from 'fs';
import test from 'ava';
import linkReplacer from '..';

var basicInput = 'https://www.codedread.com/test-crawlers.html';
var basicInputUrlSecond = 'http://www.google.com';
var basicOutputSecond = '"[Google](' + basicInputUrlSecond + ')", *google.com*';
var testImageUrl = 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png';
var basicUrlTitle = 'Test Page For Crawlers';
var basicUrlSource = 'codedread.com';
var basicOutput = '"[' + basicUrlTitle + '](' + basicInput + ')", *' + basicUrlSource + '*';
var urlWithParenthesis = 'https://en.wikipedia.org/wiki/Bent_%28band%29';
var markdownFromParenthesisUrl = '"[Bent (band)](https://en.wikipedia.org/wiki/Bent_%28band%29)", *wikipedia.org*';
var endOfFileReference = '[1]: ' + urlWithParenthesis;
var customHoganTemplate = '[{{title}}]({{url}}) from {{source}}';
var customHoganOutput = '[' + basicUrlTitle + '](' + basicInput + ') from ' + basicUrlSource;

test.cb('Basic link replacement', function (t) {
  linkReplacer.replacePlainLinks(basicInputUrlSecond, function (newMarkdown) {
    t.is(newMarkdown, basicOutputSecond);
    t.end();
  });
});

test.cb('Basic link replacement with hogan template', function (t) {
  linkReplacer.replacePlainLinks(basicInput, function (newMarkdown) {
    t.is(newMarkdown, customHoganOutput);
    t.end();
  }, customHoganTemplate);
});

test.cb('Basic link replacement in parentheses', function (t) {
  linkReplacer.replacePlainLinks('(' + basicInputUrlSecond + ')', function (newMarkdown) {
    t.is(newMarkdown, '(' + basicOutputSecond + ')');
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

test.cb('Will not replace image links', function (t) {
  linkReplacer.replacePlainLinks(testImageUrl, function (newMarkdown) {
    t.is(newMarkdown, testImageUrl);
    t.end();
  });
});

test.cb('Can handle a url with parenthesis', function (t) {
  linkReplacer.replacePlainLinks(urlWithParenthesis, function (newMarkdown) {
    t.is(newMarkdown, markdownFromParenthesisUrl);
    t.end();
  });
});

test.cb('Should handle empty input with empty output', function (t) {
  var emptyInput = '';
  linkReplacer.replacePlainLinks(emptyInput, function (newMarkdown) {
    t.is(newMarkdown, emptyInput);
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
  fs.readFile('./fixtures/wikialistsample.md', 'utf8', function (inputErr, sampleInput) {
    if (inputErr) {
      console.log(inputErr);
      t.fail();
      return;
    }
    fs.readFile('./fixtures/wikialistsample-output.md', 'utf8', function (outputErr, targetOutput) {
      if (outputErr) {
        console.log(outputErr);
        t.fail();
        return;
      }

      linkReplacer.replacePlainLinks(sampleInput, function (newMarkdown) {
        if (!newMarkdown) {
          t.fail('newMarkdown is empty');
          return;
        }
        t.is(newMarkdown, targetOutput);
        t.end();
      });
    });
  });
});
