import test from 'ava';

const parseUrlsFromMarkdownAndFilter = require('../lib/parse-urls-from-markdown-and-filter.js');

const basicInput = 'https://www.codedread.com/test-crawlers.html';

test.cb('An empty markdown should result in an empty list', t => {
  parseUrlsFromMarkdownAndFilter('', urlList => {
    t.is(urlList.length, 0);
    t.end();
  });
});

test.cb('Should be able to find a url surrounded by parenthesis', t => {
  const urlWithExtraChar = '(' + basicInput + ')';
  parseUrlsFromMarkdownAndFilter(urlWithExtraChar, urlList => {
    t.is(urlList.length, 1);
    t.end();
  });
});

test.cb('Should chop a hanging parenthesis from the url if there isn\t an open parenthesis in the url', t => {
  const urlWithExtraChar = basicInput + ')';
  parseUrlsFromMarkdownAndFilter(urlWithExtraChar, urlList => {
    t.is(urlList.length, 1);
    t.is(urlList[0], basicInput);
    t.end();
  });
});
