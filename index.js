'use strict';

const Promise = require('bluebird');
const he = require('he');
const debug = require('debug')('index');
const filterValidUrlsAndLookupTitles = require('./lib/filter-valid-urls-and-lookup-titles.js');
const parseUrlsFromMarkdownAndFilter = require('./lib/parse-urls-from-markdown-and-filter.js');
const replaceParsedPlainLinksWithTitles = require('./lib/replace-parsed-plain-links-with-titles.js');

function replacePlainLinks(markdown, callback, hoganTemplate) {
  if (!markdown) {
    callback(markdown);
    return;
  }

  const decodedMarkdown = he.decode(markdown);
  parseUrlsFromMarkdownAndFilter(decodedMarkdown, urls => {
    const lookupPromises = filterValidUrlsAndLookupTitles(urls, decodedMarkdown, hoganTemplate)
      ;
    function handleLookupResult(res) {
      debug(res);

      replaceParsedPlainLinksWithTitles(res, decodedMarkdown, callback);
    }

    Promise.all(lookupPromises)
      .then(handleLookupResult);
  });
}

module.exports = {replacePlainLinks};
