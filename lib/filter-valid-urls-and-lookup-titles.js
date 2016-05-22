var getTitleAtUrl = require('get-title-at-url');
var iterate = require('array-iterate');
var parseDomain = require('parse-domain');
var hoganJs = require('hogan.js');
var debug = require('debug')('filter-valid-urls-and-lookup-titles');
var urlValidator = require('./markdown-webpage-url-validator.js');
var DEFAULT_TEMPLATE = '"[{{title}}]({{url}})", *{{source}}*';

function getTemplateFunc(hoganTemplate) {
  if (!hoganTemplate) {
    hoganTemplate = DEFAULT_TEMPLATE;
  }

  return hoganJs.compile(hoganTemplate);
}

function takeTitleAndGenerateReplacementEntry(url, template, resolve) {
  function generateReplacementEntry(title) {
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
  }

  getTitleAtUrl(url, generateReplacementEntry);
}

function geneneratePromiseForTitleLookup(url, template, delayMs) {
  function setReplacementTimeout(resolve) {
    setTimeout(takeTitleAndGenerateReplacementEntry, delayMs, url, template, resolve);
  }

  debug('Creating promise to find url: ' + url);

  var newPromise = new Promise(setReplacementTimeout);

  return newPromise;
}

module.exports = function filterValidUrlsAndLookupTitles(urls, markdown, hoganTemplate) {
  var template = getTemplateFunc(hoganTemplate);
  var initialDelayMillisecoonds = 0;
  var titleLookupPromises = [];

  if (!markdown) {
    throw new Error('Argument markdown not set');
  }

  function iterateOverUrls(currentUrl) {
    var urlIndexTracker = 0;

    while (markdown.indexOf(currentUrl, urlIndexTracker) !== -1) {
      var currentUrlIndex = urlIndexTracker;
      var currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
      urlIndexTracker = currentUrlStart + currentUrl.length;

      if (!urlValidator.isUrlValidWithinMarkdown(currentUrlIndex, currentUrl, markdown)) {
        continue;
      }

      var titleLookupPromise = geneneratePromiseForTitleLookup(currentUrl, template, initialDelayMillisecoonds);
      initialDelayMillisecoonds += 100;

      titleLookupPromises.push(titleLookupPromise);
      break;
    }
  }

  iterate(urls, iterateOverUrls);

  return titleLookupPromises;
};
