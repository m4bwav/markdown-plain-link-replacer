import test from 'ava';
var parseUrlsFromMarkdownAndFilter = require('../lib/parse-urls-from-markdown-and-filter.js');

var basicInput = 'http://www.google.com/';

test('An empty markdown should result in an empty list', function (t) {
  var urlList = parseUrlsFromMarkdownAndFilter('');

  t.is(urlList.length, 0);
});

test('Should be able to find a url surrounded by parenthesis', function (t) {
  var urlWithExtraChar = '(' + basicInput + ')';
  var urlList = parseUrlsFromMarkdownAndFilter(urlWithExtraChar);

  t.is(urlList.length, 1);
});

test('Should chop a hanging parenthesis from the url if there isn\t an open parenthesis in the url', function (t) {
  var urlWithExtraChar = basicInput + ')';
  var urlList = parseUrlsFromMarkdownAndFilter(urlWithExtraChar);

  t.is(urlList.length, 1);
  t.is(urlList[0], basicInput);
});
