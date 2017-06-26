const getTitleAtUrl = require('get-title-at-url');
const iterate = require('array-iterate');
const parseDomain = require('parse-domain');
const hoganJs = require('hogan.js');
const debug = require('debug')('filter-valid-urls-and-lookup-titles');
const urlValidator = require('./markdown-webpage-url-validator.js');

const DEFAULT_TEMPLATE = '"[{{title}}]({{url}})", *{{source}}*';

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

    const domainData = parseDomain(url);
    const source = domainData.domain + '.' + domainData.tld;
    const templateData = {
      url,
      title,
      source
    };

    const titleMarkdown = template.render(templateData);

    const urlTitleMarkdownPair = {
      url,
      titleMarkdown
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

  return new Promise(setReplacementTimeout);
}

module.exports = (urls, markdown, hoganTemplate) => {
  const template = getTemplateFunc(hoganTemplate);
  let initialDelayMillisecoonds = 0;
  const titleLookupPromises = [];

  if (!markdown) {
    throw new Error('Argument markdown not set');
  }

  function iterateOverUrls(currentUrl) {
    let urlIndexTracker = 0;

    while (markdown.indexOf(currentUrl, urlIndexTracker) !== -1) {
      const currentUrlIndex = urlIndexTracker;
      const currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
      urlIndexTracker = currentUrlStart + currentUrl.length;

      if (!urlValidator.isUrlValidWithinMarkdown(currentUrlIndex, currentUrl, markdown)) {
        continue;
      }

      const titleLookupPromise = geneneratePromiseForTitleLookup(currentUrl, template, initialDelayMillisecoonds);
      initialDelayMillisecoonds += 100;

      titleLookupPromises.push(titleLookupPromise);
      break;
    }
  }

  iterate(urls, iterateOverUrls);

  return titleLookupPromises;
};
