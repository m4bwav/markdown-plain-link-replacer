'use strict';

var Promise = require('bluebird');
var he = require('he');
var debug = require('debug')('index');
var filterValidUrlsAndLookupTitles = require('./lib/filter-valid-urls-and-lookup-titles.js');
var parseUrlsFromMarkdownAndFilter = require('./lib/parse-urls-from-markdown-and-filter.js');
var replaceParsedPlainLinksWithTitles = require('./lib/replace-parsed-plain-links-with-titles.js');
var exports = module.exports = {}
  ;

exports.replacePlainLinks = function (markdown, callback) {
  if (!markdown) {
    callback(markdown);
    return;
  }

  var decodedMarkdown = he.decode(markdown);
  var urls = parseUrlsFromMarkdownAndFilter(decodedMarkdown);
  var lookupPromises = filterValidUrlsAndLookupTitles(urls, decodedMarkdown)
    ;

  Promise.all(lookupPromises)
    .then(function (res) {
      debug(res);

      replaceParsedPlainLinksWithTitles(res, decodedMarkdown, callback);
    }
  );
};
