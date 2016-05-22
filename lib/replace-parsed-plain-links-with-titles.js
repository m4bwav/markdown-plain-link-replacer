var iterate = require('array-iterate');
var debug = require('debug')('replace-parsed-plain-links-with-titles');
var urlValidator = require('./markdown-webpage-url-validator.js');
var replaceLinksInString = require('./replace-links-in-string.js');

module.exports = function (urlTitleList, markdown, callback) {
  iterate(urlTitleList, function (urlTitleMarkdownPair) {
    if (!urlTitleMarkdownPair) {
      return true;
    }

    var currentUrl = urlTitleMarkdownPair.url;
    var urlIndexTracker = 0;

    if (!currentUrl) {
      return true;
    }

    debug('Attempting to replace url: ' + currentUrl);
    var nextIndexOf = markdown.indexOf(currentUrl, urlIndexTracker);
    debug('Next index of url: ' + currentUrl + ' is at position: ' + nextIndexOf + ' during replacement');

    while (markdown.indexOf(currentUrl, urlIndexTracker) !== -1) {
      var currentUrlIndex = urlIndexTracker;
      var currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
      urlIndexTracker = currentUrlStart + currentUrl.length;

      debug('Looking for url during replacement: ' + currentUrl + ' after position: ' + currentUrlIndex);

      if (!urlValidator.isUrlValidWithinMarkdown(currentUrlIndex, currentUrl, markdown)) {
        continue;
      }

      markdown = replaceLinksInString(markdown, urlTitleMarkdownPair, currentUrlStart);
      urlIndexTracker = currentUrlStart + urlTitleMarkdownPair.titleMarkdown.length;
    }
  });

  callback(markdown);
};
