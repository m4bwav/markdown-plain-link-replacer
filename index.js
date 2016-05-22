'use strict';

var Promise = require('bluebird');
var he = require('he');
var debug = require('debug')('index');
var filterValidUrlsAndLookupTitles = require('./lib/filter-valid-urls-and-lookup-titles.js');
var parseUrlsFromMarkdownAndFilter = require('./lib/parse-urls-from-markdown-and-filter.js');
var replaceParsedPlainLinksWithTitles = require('./lib/replace-parsed-plain-links-with-titles.js');
var exports = module.exports = {}
  ;

function replacePlainLinks(markdown, callback, hoganTemplate) {
  if (!markdown) {
    callback(markdown);
    return;
  }

  var decodedMarkdown = he.decode(markdown);
  var urls = parseUrlsFromMarkdownAndFilter(decodedMarkdown);
  var lookupPromises = filterValidUrlsAndLookupTitles(urls, decodedMarkdown, hoganTemplate)
    ;
  function handleLookupResult(res) {
    debug(res);

    replaceParsedPlainLinksWithTitles(res, decodedMarkdown, callback);
  }

  Promise.all(lookupPromises)
    .then(handleLookupResult);
}

exports.replacePlainLinks = replacePlainLinks;
