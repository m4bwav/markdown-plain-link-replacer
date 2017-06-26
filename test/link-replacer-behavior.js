import fs from 'fs';
import test from 'ava';
import linkReplacer from '..';

const basicInput = 'https://www.codedread.com/test-crawlers.html';
const basicInputUrlSecond = 'http://www.google.com';
const basicOutputSecond = '"[Google](' + basicInputUrlSecond + ')", *google.com*';
const testImageUrl = 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png';
const basicUrlTitle = 'Test Page For Crawlers';
const basicUrlSource = 'codedread.com';
const basicOutput = '"[' + basicUrlTitle + '](' + basicInput + ')", *' + basicUrlSource + '*';
const urlWithParenthesis = 'https://en.wikipedia.org/wiki/Bent_%28band%29';
const markdownFromParenthesisUrl = '"[Bent (band)](https://en.wikipedia.org/wiki/Bent_%28band%29)", *wikipedia.org*';
const endOfFileReference = '[1]: ' + urlWithParenthesis;
const customHoganTemplate = '[{{title}}]({{url}}) from {{source}}';
const customHoganOutput = '[Google](' + basicInputUrlSecond + ') from google.com';

test.cb('Basic link replacement', t => {
  linkReplacer.replacePlainLinks(basicInputUrlSecond, newMarkdown => {
    t.is(newMarkdown, basicOutputSecond);
    t.end();
  });
});

test.cb('Basic link replacement with hogan template', t => {
  linkReplacer.replacePlainLinks(basicInputUrlSecond, newMarkdown => {
    t.is(newMarkdown, customHoganOutput);
    t.end();
  }, customHoganTemplate);
});

test.cb('Basic link replacement in parentheses', t => {
  linkReplacer.replacePlainLinks('(' + basicInputUrlSecond + ')', newMarkdown => {
    t.is(newMarkdown, '(' + basicOutputSecond + ')');
    t.end();
  });
});

test.cb('A link that is part of existing markdown link should not be replaced', t => {
  linkReplacer.replacePlainLinks(basicOutput, newMarkdown => {
    t.is(newMarkdown, basicOutput);
    t.end();
  });
});

test.cb('A link that is part of the reference list at the end of markdown, should not be replaced', t => {
  linkReplacer.replacePlainLinks(endOfFileReference, newMarkdown => {
    t.is(newMarkdown, endOfFileReference);
    t.end();
  });
});

test.cb('Will not replace image links', t => {
  linkReplacer.replacePlainLinks(testImageUrl, newMarkdown => {
    t.is(newMarkdown, testImageUrl);
    t.end();
  });
});

test.cb('Can handle a url with parenthesis', t => {
  linkReplacer.replacePlainLinks(urlWithParenthesis, newMarkdown => {
    t.is(newMarkdown, markdownFromParenthesisUrl);
    t.end();
  });
});

test.cb('Should handle empty input with empty output', t => {
  const emptyInput = '';
  linkReplacer.replacePlainLinks(emptyInput, newMarkdown => {
    t.is(newMarkdown, emptyInput);
    t.end();
  });
});

test.cb('A 404 title shouldn\t be replaced', t => {
  const fourOhFourUrl = 'http://www.google.com/aaa';
  linkReplacer.replacePlainLinks(fourOhFourUrl, newMarkdown => {
    t.is(newMarkdown, fourOhFourUrl);
    t.end();
  });
});

test.cb('Can handle a typical list of wikia urls at end of article', t => {
  fs.readFile('./test/fixtures/wikialistsample.md', 'utf8', (inputErr, sampleInput) => {
    if (inputErr) {
      console.log(inputErr);
      t.fail();
      return;
    }
    fs.readFile('./test/fixtures/wikialistsample-output.md', 'utf8', (outputErr, targetOutput) => {
      if (outputErr) {
        console.log(outputErr);
        t.fail();
        return;
      }

      linkReplacer.replacePlainLinks(sampleInput, newMarkdown => {
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
