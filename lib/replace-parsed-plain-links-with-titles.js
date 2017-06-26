const iterate = require('array-iterate');
const replaceStringAtPosition = require('replace-string-at-position');
const debug = require('debug')('replace-parsed-plain-links-with-titles');
const urlValidator = require('./markdown-webpage-url-validator.js');

function replaceLinksInString(source, urlTitleMarkdownPair, position) {
  const linkToReplace = urlTitleMarkdownPair.url;
  const newLinkMarkdown = urlTitleMarkdownPair.titleMarkdown;

  return replaceStringAtPosition(source, linkToReplace, newLinkMarkdown, position);
}

function replaceParsedPlainLinksWithTitles(urlTitleList, markdown, callback) {
  function iterateThroughFilteredUrls(urlTitleMarkdownPair) {
    if (!urlTitleMarkdownPair) {
      return true;
    }

    const currentUrl = urlTitleMarkdownPair.url;
    let urlIndexTracker = 0;

    if (!currentUrl) {
      return true;
    }

    debug('Attempting to replace url: ' + currentUrl);
    const nextIndexOf = markdown.indexOf(currentUrl, urlIndexTracker);
    debug('Next index of url: ' + currentUrl + ' is at position: ' + nextIndexOf + ' during replacement');

    while (markdown.indexOf(currentUrl, urlIndexTracker) !== -1) {
      const currentUrlIndex = urlIndexTracker;
      const currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
      urlIndexTracker = currentUrlStart + currentUrl.length;

      debug('Looking for url during replacement: ' + currentUrl + ' after position: ' + currentUrlIndex);

      if (!urlValidator.isUrlValidWithinMarkdown(currentUrlIndex, currentUrl, markdown)) {
        continue;
      }

      markdown = replaceLinksInString(markdown, urlTitleMarkdownPair, currentUrlStart);
      urlIndexTracker = currentUrlStart + urlTitleMarkdownPair.titleMarkdown.length;
    }
  }

  iterate(urlTitleList, iterateThroughFilteredUrls);

  callback(markdown);
}

module.exports = replaceParsedPlainLinksWithTitles;
