'use strict';

var getUrls = require('get-urls');
var iterate = require('array-iterate');
var isUrl = require('is-url');
var getTitleAtUrl = require('get-title-at-url');
var Promise = require('Promise');
var parseDomain = require('parse-domain');
var he = require('he');
var exports = module.exports = {}
  ;

function replaceLinkAtPosition(markdown, urlTitleMarkdownPair, position) {
  var linkToReplace = urlTitleMarkdownPair.url;
  var newLinkMarkdown = urlTitleMarkdownPair.titleMarkdown;
  var linkLength = linkToReplace.length;
  var prefix = markdown.substring(0, position);
  var afterStartPosition = position + linkLength;
  var postfix = markdown.substring(afterStartPosition, markdown.length);
  var result = prefix + newLinkMarkdown + postfix;

  return result;
}

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

function filterValidUrlsAndLookupTitles(urls, markdown, options) {
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
}

function executeReplacePlainLinksWithTitles(urlTitleList, markdown, callback, options) {
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

    if (options.d && options.d.indexOf && options.d.indexOf('replacement') !== -1) {
      console.log('Attempting to replace url: ' + currentUrl);
      var nextIndexOf = markdown.indexOf(currentUrl, urlIndexTracker);
      console.log('Next index of url: ' + currentUrl + ' is at position: ' + nextIndexOf + ' during replacement');
    }
    while (markdown.indexOf(currentUrl, urlIndexTracker) !== -1) {
      var currentUrlIndex = urlIndexTracker;
      var currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
      if (options.d && options.d.indexOf && options.d.indexOf('replacement') !== -1) {
        console.log('Looking for url during replacement: ' + currentUrl + ' after position: ' + currentUrlIndex);
      }
      if ((currentUrlStart + currentUrl.length) < markdown.length) {
        var endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
        var urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);

        if (!urlPlusOneChar.endsWith(')') && isUrl(urlPlusOneChar)) {
          urlIndexTracker = currentUrlStart + currentUrl.length;
          if (options.d && options.d.indexOf && options.d.indexOf('replacement') !== -1) {
            console.log('Skipping replacement of url: ' + currentUrl + ' for short version of url.');
          }
          continue;
        }

        if (currentUrlStart > 2) {
          var twoCharPrecendingString = markdown.substring(currentUrlStart - 2, currentUrlStart);

          if (twoCharPrecendingString === '](') {
            urlIndexTracker = currentUrlStart + currentUrl.length;
            if (options.d && options.d.indexOf && options.d.indexOf('replacement') !== -1) {
              console.log('Skipping replacement of url: ' + currentUrl + '  for ]( prefix.');
            }
            continue;
          }
        }

        if (currentUrlStart > 3) {
          var precendingString = markdown.substring(currentUrlStart - 3, currentUrlStart);

          if (precendingString === ']: ') {
            urlIndexTracker = currentUrlStart + currentUrl.length;
            if (options.d && options.d.indexOf && options.d.indexOf('replacement') !== -1) {
              console.log('Skipping replacement of url: ' + currentUrl + ' for ]: prefix.');
            }
            continue;
          }
        }
      }
      markdown = replaceLinkAtPosition(markdown, urlTitleMarkdownPair, currentUrlStart);
      urlIndexTracker = currentUrlStart + urlTitleMarkdownPair.titleMarkdown.length;
    }
  });

  callback(markdown);
}

function getUrlsAndFilter(markdown, options) {
  var urls = getUrls(markdown, {stripWWW: false, stripFragment: false, normalizeProtocol: false, removeQueryParameters: []});
  var outputResults = [];

  if (options.d && options.d.indexOf && options.d.indexOf('urlread') !== -1) {
    console.log('getUrls output:');
    console.log(urls);
  }

  iterate(urls, function (currentUrl) {
    if (!currentUrl) {
      return true;
    }

    if (currentUrl.endsWith(')') && currentUrl.indexOf('(') === -1) {
      currentUrl = currentUrl.substring(0, currentUrl.length - 1);
      if (options.d && options.d.indexOf && options.d.indexOf('urlread') !== -1) {
        console.log('new url: ' + currentUrl);
      }
    }

    if (currentUrl.toLowerCase().endsWith('.jpg')) {
      if (options.d && options.d.indexOf && options.d.indexOf('urlread') !== -1) {
        console.log('skipping url: ' + currentUrl);
      }
      return true;
    }
    if (outputResults.indexOf(currentUrl) === -1) {
      if (options.d && options.d.indexOf && options.d.indexOf('urlread') !== -1) {
        console.log('pushing url: ' + currentUrl);
      }
      outputResults.push(currentUrl.toLowerCase());
    }
  });

  return outputResults;
}

exports.replacePlainLinks = function (markdown, callback, options) {
  if (!markdown) {
    callback(markdown);
    return;
  }

  if (!options) {
    options = {};
  }

  var decodedMarkdown = he.decode(markdown);
  var urls = getUrlsAndFilter(decodedMarkdown, options);
  var lookupPromises = filterValidUrlsAndLookupTitles(urls, decodedMarkdown, options)
    ;

  Promise.all(lookupPromises)
    .then(function (res) {
      if (options.d && options.d.indexOf && options.d.indexOf('promisecomplete') !== -1) {
        console.log(res);
      }
      executeReplacePlainLinksWithTitles(res, decodedMarkdown, callback, options);
    }
  );
};
