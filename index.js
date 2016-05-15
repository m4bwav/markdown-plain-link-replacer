'use strict';

var Promise = require('bluebird');
var he = require('he');
var filterValidUrlsAndLookupTitles = require('./lib/filter-valid-urls-and-lookup-titles.js');
var parseUrlsFromMarkdownAndFilter = require('./lib/parse-urls-from-markdown-and-filter.js');
var replaceParsedPlainLinksWithTitles = require('./lib/replace-parsed-plain-links-with-titles.js');
var exports = module.exports = {}
  ;


exports.replacePlainLinks = function (markdown, callback, options) {
  if (!markdown) {
    callback(markdown);
    return;
  }

  if (!options) {
    options = {};
  }

  var decodedMarkdown = he.decode(markdown);
  var urls = parseUrlsFromMarkdownAndFilter(decodedMarkdown, options);
  var lookupPromises = filterValidUrlsAndLookupTitles(urls, decodedMarkdown, options)
    ;

  Promise.all(lookupPromises)
    .then(function (res) {
      if (options.d && options.d.indexOf && options.d.indexOf('promisecomplete') !== -1) {
        console.log(res);
      }
      replaceParsedPlainLinksWithTitles(res, decodedMarkdown, callback, options);
    }
  );
};
