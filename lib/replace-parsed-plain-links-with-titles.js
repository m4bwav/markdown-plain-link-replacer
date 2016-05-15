var iterate = require('array-iterate');
var isUrl = require('is-url');
var debug = require('debug')('replace-parsed-plain-links-with-titles');
var replaceLinksInString = require('./replace-links-in-string.js');

module.exports = function (urlTitleList, markdown, callback) {
  iterate(urlTitleList, function (urlTitleMarkdownPair) {
    if (!urlTitleMarkdownPair) {
      return true;
    }

    var currentUrl = urlTitleMarkdownPair.url;
    var urlIndexTracker = 0
      ;

    if (!currentUrl) {
      return true;
    }

    debug('Attempting to replace url: ' + currentUrl);
    var nextIndexOf = markdown.indexOf(currentUrl, urlIndexTracker);
    debug('Next index of url: ' + currentUrl + ' is at position: ' + nextIndexOf + ' during replacement');

    while (markdown.indexOf(currentUrl, urlIndexTracker) !== -1) {
      var currentUrlIndex = urlIndexTracker;
      var currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
      debug('Looking for url during replacement: ' + currentUrl + ' after position: ' + currentUrlIndex);

      if ((currentUrlStart + currentUrl.length) < markdown.length) {
        var endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
        var urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);

        if (!urlPlusOneChar.endsWith(')') && isUrl(urlPlusOneChar)) {
          urlIndexTracker = currentUrlStart + currentUrl.length;
          debug('Skipping replacement of url: ' + currentUrl + ' for short version of url.');

          continue;
        }

        if (currentUrlStart > 2) {
          var twoCharPrecendingString = markdown.substring(currentUrlStart - 2, currentUrlStart);

          if (twoCharPrecendingString === '](') {
            urlIndexTracker = currentUrlStart + currentUrl.length;
            debug('Skipping replacement of url: ' + currentUrl + '  for ]( prefix.');

            continue;
          }
        }

        if (currentUrlStart > 3) {
          var precendingString = markdown.substring(currentUrlStart - 3, currentUrlStart);

          if (precendingString === ']: ') {
            urlIndexTracker = currentUrlStart + currentUrl.length;
            debug('Skipping replacement of url: ' + currentUrl + ' for ]: prefix.');

            continue;
          }
        }
      }
      markdown = replaceLinksInString(markdown, urlTitleMarkdownPair, currentUrlStart);
      urlIndexTracker = currentUrlStart + urlTitleMarkdownPair.titleMarkdown.length;
    }
  });

  callback(markdown);
};
