var getUrls = require('get-urls');
var iterate = require('array-iterate');
var isImageUrl = require('is-image-url');
var debug = require('debug')('parse-urls-from-markdown-and-filter');

module.exports = function parseUrlsFromMarkdownAndFilter(markdown) {
  var urls = getUrls(markdown, {stripWWW: false, stripFragment: false, normalizeProtocol: false, removeQueryParameters: []});
  var outputResults = [];

  debug('getUrls output:');
  debug(urls);

  function iterateThroughUrlsForParsing(currentUrl) {
    if (currentUrl.endsWith(')') && currentUrl.indexOf('(') === -1) {
      currentUrl = currentUrl.substring(0, currentUrl.length - 1);
      debug('new url: ' + currentUrl);
    }

    if (isImageUrl(currentUrl)) {
      debug('skipping url: ' + currentUrl);
      return true;
    }

    if (outputResults.indexOf(currentUrl) === -1) {
      debug('pushing url: ' + currentUrl);
      outputResults.push(currentUrl);
    }
  }

  iterate(urls, iterateThroughUrlsForParsing);

  return outputResults;
};
