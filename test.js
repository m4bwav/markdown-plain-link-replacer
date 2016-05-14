import test from 'ava';
import linkReplacer from './';

test.cb('Basic link replacement', function (t) {
  linkReplacer.replacePlainLinks("http://www.google.com", function (newMarkdown) {
    t.is(newMarkdown, '[Google], *google.com*');
    t.end();
  });
});
