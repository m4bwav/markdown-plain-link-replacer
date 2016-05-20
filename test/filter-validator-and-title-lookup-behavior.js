import test from 'ava';
import filterValidator from '../lib/filter-valid-urls-and-lookup-titles.js';

var basicInput = 'https://www.codedread.com/test-crawlers.html';

test('If a url is really part of another url it should be filtered out', function (t) {
  var urlWithExtraChar = basicInput + 'a';
  var promiseList = filterValidator([basicInput], urlWithExtraChar);

  t.is(promiseList.length, 0);
});

test('Empty markdown should cause an exception', function (t) {
  try {
    filterValidator([basicInput], '');
    t.fail('Shouldn\t have been able to use an empty markdown param');
  } catch (error) {
    t.pass();
  }
});
