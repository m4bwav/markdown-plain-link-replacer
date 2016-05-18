var isUrl = require('is-url');
var getTitleAtUrl = require('get-title-at-url');
var iterate = require('array-iterate');
var parseDomain = require('parse-domain');
var debug = require('debug')('filter-valid-urls-and-lookup-titles');

function generateTitleMarkdown(url, title, source) {
  return '"[' + title + '](' + url + ')", *' + source + '*';
}

function geneneratePromiseForTitleLookup(url) {
  debug('Creating promise to find url: ' + url);

  return new Promise(function (resolve) {
    getTitleAtUrl(url, function (title) {
      debug('title: ' + title + ' found for url: ' + url);

      if (!title) {
        resolve();
        return;
      }

      var domainData = parseDomain(url);
      var source = domainData.domain + '.' + domainData.tld;
      var urlTitleMarkdownPair = {
        url: url,
        titleMarkdown: generateTitleMarkdown(url, title, source)
      };

      resolve(urlTitleMarkdownPair);
    });
  });
}

module.exports = function (urls, markdown, options) {
  var titleLookupPromises = [];

  iterate(urls, function (currentUrl) {
    var urlIndexTracker = 0;

    while (markdown.indexOf(currentUrl, urlIndexTracker) !== -1) {
      var currentUrlIndex = urlIndexTracker;
      var currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
      urlIndexTracker = currentUrlStart + currentUrl.length;

      if ((currentUrlStart + currentUrl.length) < markdown.length) {
        var endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
        var urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);

        if (!urlPlusOneChar.endsWith(')') && isUrl(urlPlusOneChar)) {
          continue;
        }
      }
      if (currentUrlStart > 2) {
        var positionTwoCharactersBack = currentUrlStart - 2;
        var twoCharPrecendingString = markdown.substring(positionTwoCharactersBack, currentUrlStart);

        if (twoCharPrecendingString === '](') {
          continue;
        }
      }

      if (currentUrlStart > 3) {
        var precendingString = markdown.substring(currentUrlStart - 3, currentUrlStart);

        if (precendingString === ']: ') {
          continue;
        }
      }

      var titleLookupPromise = geneneratePromiseForTitleLookup(currentUrl, options);

      titleLookupPromises.push(titleLookupPromise);
      break;
    }
  });

  return titleLookupPromises;
};
