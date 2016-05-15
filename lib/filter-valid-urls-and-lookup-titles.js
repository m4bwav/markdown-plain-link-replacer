var isUrl = require('is-url');
var getTitleAtUrl = require('get-title-at-url');
var iterate = require('array-iterate');
var parseDomain = require('parse-domain');

function generateTitleMarkdown(url, title, source) {
  return '"[' + title + '](' + url + ')", *' + source + '*';
}

function geneneratePromiseForTitleLookup(url, options) {
  if (options.d && options.d.indexOf && options.d.indexOf('urlresponse') !== -1) {
    console.log('Creating promise to find url: ' + url);
  }

  return new Promise(function (resolve) {
    getTitleAtUrl(url, function (title) {
      if (options.d && options.d.indexOf && options.d.indexOf('urlresponse') !== -1) {
        console.log('title: ' + title + ' found for url: ' + url);
      }

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
  var loweredMarkdown = markdown.toLowerCase()
  ;

  iterate(urls, function (currentUrl) {
    var urlIndexTracker = 0;

    if (options.d) {
      var nextIndexOf = loweredMarkdown.indexOf(currentUrl, urlIndexTracker);
      if (nextIndexOf === -1) {
        console.log('\nCould not find url: ' + currentUrl + ' that was previously found in the markdown during parsing, urlIndexTracker: ' + urlIndexTracker);
      }
    }
    while (loweredMarkdown.indexOf(currentUrl, urlIndexTracker) !== -1) {
      var currentUrlIndex = urlIndexTracker;
      var currentUrlStart = loweredMarkdown.indexOf(currentUrl, currentUrlIndex);
      urlIndexTracker = currentUrlStart + currentUrl.length;

      if ((currentUrlStart + currentUrl.length) < markdown.length) {
        var endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
        var urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);

        if (!urlPlusOneChar.endsWith(')') && isUrl(urlPlusOneChar)) {
          continue;
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
      }

      var titleLookupPromise = geneneratePromiseForTitleLookup(currentUrl, options);

      titleLookupPromises.push(titleLookupPromise);
      break;
    }
  });

  return titleLookupPromises;
};
