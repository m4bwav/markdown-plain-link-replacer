var isUrl = require('is-url');
var getTitleAtUrl = require('get-title-at-url');
var iterate = require('array-iterate');
var parseDomain = require('parse-domain');
var hoganJs = require('hogan.js');
var debug = require('debug')('filter-valid-urls-and-lookup-titles');

function getTemplateFunc(hoganTemplate) {
  if (!hoganTemplate) {
    hoganTemplate = '"[{{title}}]({{url}})", *{{source}}*';
  }

  return hoganJs.compile(hoganTemplate);
}

function geneneratePromiseForTitleLookup(url, template, delayMs) {
  debug('Creating promise to find url: ' + url);
  var newPromise = new Promise(function (resolve) {
    setTimeout(function () {
      getTitleAtUrl(url, function (title) {
        debug('title: ' + title + ' found for url: ' + url);

        if (!title) {
          resolve();
          return;
        }

        var domainData = parseDomain(url);
        var source = domainData.domain + '.' + domainData.tld;
        var templateData = {
          url: url,
          title: title,
          source: source
        };

        var titleMarkdown = template.render(templateData);

        var urlTitleMarkdownPair = {
          url: url,
          titleMarkdown: titleMarkdown
        };

        resolve(urlTitleMarkdownPair);
      });
    }, delayMs);
  });

  return newPromise;
}

module.exports = function (urls, markdown, hoganTemplate) {
  var template = getTemplateFunc(hoganTemplate);
  var initialDelayMillisecoonds = 0;
  var titleLookupPromises = [];

  if (!markdown) {
    throw new Error('Argument markdown not set');
  }

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

      var titleLookupPromise = geneneratePromiseForTitleLookup(currentUrl, template, initialDelayMillisecoonds);
      initialDelayMillisecoonds += 100;

      titleLookupPromises.push(titleLookupPromise);
      break;
    }
  });

  return titleLookupPromises;
};
