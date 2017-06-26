import test from 'ava';

const replaceParsedPlainLinksWithTitles = require('../lib/replace-parsed-plain-links-with-titles.js');

const basicInput = 'https://www.codedread.com/test-crawlers.html';
const basicPlusSlash = basicInput + '/';
const endOfFileReference = '[1]: ' + basicInput;

const basicInputUrlSecond = 'http://www.google.com';
const basicOutputSecond = '"[Google](' + basicInputUrlSecond + ')", *google.com*';

test.cb('An empty markdown should result in an empty list', t => {
  const inputArray = [{
    titleMarkdown: 'Does not matter',
    url: basicInput
  }];

  t.plan(1);
  try {
    replaceParsedPlainLinksWithTitles(inputArray, endOfFileReference, outputMarkdown => {
      t.is(endOfFileReference, outputMarkdown);
      t.end();
    });
  } catch (err) {
    t.fail(err.message);
    t.end();
  }
});

test.cb('An empty url should be skipped in the results', t => {
  const inputArray = [{
    titleMarkdown: '',
    url: ''
  }];

  t.plan(1);
  try {
    replaceParsedPlainLinksWithTitles(inputArray, endOfFileReference, outputMarkdown => {
      t.is(endOfFileReference, outputMarkdown);
      t.end();
    });
  } catch (err) {
    t.fail(err.message);
    t.end();
  }
});

test.cb('A short part of url should not be replace a longer part', t => {
  const inputArray = [{
    titleMarkdown: 'some title markdown',
    url: basicInput
  }];

  t.plan(1);
  try {
    replaceParsedPlainLinksWithTitles(inputArray, basicPlusSlash, outputMarkdown => {
      t.is(basicPlusSlash, outputMarkdown);
      t.end();
    });
  } catch (err) {
    t.fail(err.message);
    t.end();
  }
});

test.cb('Won\'t replace a url that is already linkified', t => {
  const inputArray = [{
    titleMarkdown: basicOutputSecond,
    url: basicInputUrlSecond
  }];

  t.plan(1);
  try {
    replaceParsedPlainLinksWithTitles(inputArray, basicOutputSecond, outputMarkdown => {
      t.is(basicOutputSecond, outputMarkdown);
      t.end();
    });
  } catch (err) {
    t.fail(err.message);
    t.end();
  }
});
