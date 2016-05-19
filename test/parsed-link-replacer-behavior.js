import test from 'ava';
var replaceParsedPlainLinksWithTitles = require('../lib/replace-parsed-plain-links-with-titles.js');

var basicInput = 'http://www.google.com/';
var basicPlusSlash = basicInput + '/';
var endOfFileReference = '[1]: ' + basicInput;

test.cb('An empty markdown should result in an empty list', function (t) {
  var inputArray = [{
    titleMarkdown: 'Does not matter',
    url: basicInput
  }];

  t.plan(1);
  try {
    replaceParsedPlainLinksWithTitles(inputArray, endOfFileReference, function (outputMarkdown) {
      t.is(endOfFileReference, outputMarkdown);
      t.end();
    });
  } catch (error) {
    t.fail(error.message);
    t.end();
  }
});

test.cb('An empty url should be skipped in the results', function (t) {
  var inputArray = [{
    titleMarkdown: '',
    url: ''
  }];

  t.plan(1);
  try {
    replaceParsedPlainLinksWithTitles(inputArray, endOfFileReference, function (outputMarkdown) {
      t.is(endOfFileReference, outputMarkdown);
      t.end();
    });
  } catch (error) {
    t.fail(error.message);
    t.end();
  }
});

test.cb('A short part of url should not be replace a longer part', function (t) {
  var inputArray = [{
    titleMarkdown: 'some title markdown',
    url: basicInput
  }];

  t.plan(1);
  try {
    replaceParsedPlainLinksWithTitles(inputArray, basicPlusSlash, function (outputMarkdown) {
      t.is(basicPlusSlash, outputMarkdown);
      t.end();
    });
  } catch (error) {
    t.fail(error.message);
    t.end();
  }
});
