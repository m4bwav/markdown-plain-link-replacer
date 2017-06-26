const urlRegex = require('url-regex');
const Promise = require('bluebird');
const iterate = require('array-iterate');
const isAnImageUrl = require('is-an-image-url');
const debug = require('debug')('parse-urls-from-markdown-and-filter');

function getUrls(markdown) {
  const urls = markdown.match(urlRegex());

  if (!urls) {
    return [];
  }

  return urls.map(url => url.trim().replace(/\.+$/, ''));
}

function processUrlForValidity(currentUrl, resolve) {
  if (currentUrl.endsWith(')') && currentUrl.indexOf('(') === -1) {
    currentUrl = currentUrl.substring(0, currentUrl.length - 1);
    debug('new url: ' + currentUrl);
  }

  const result = {
    isValid: false,
    url: currentUrl
  };

  isAnImageUrl(currentUrl, isAnImageResult => {
    if (isAnImageResult) {
      resolve(result);
      return;
    }

    result.isValid = true;

    resolve(result);
  });
}

function processPromiseResults(resultList, callback) {
  const outputResults = [];

  iterate(resultList, checkResult => {
    if (!checkResult.isValid) {
      return;
    }

    const currentUrl = checkResult.url;

    if (outputResults.indexOf(currentUrl) === -1) {
      outputResults.push(currentUrl);
    }
  });

  callback(outputResults);
}

module.exports = (markdown, callback) => {
  const urls = getUrls(markdown);
  const urlCheckPromises = [];

  function iterateThroughUrlsForParsing(currentUrl) {
    function executePromise(resolve) {
      processUrlForValidity(currentUrl, resolve);
    }

    urlCheckPromises.push(new Promise(executePromise));
  }

  debug('urls: ' + urls);
  iterate(urls, iterateThroughUrlsForParsing);

  function handleLookupResult(res) {
    debug('res: ' + res);
    processPromiseResults(res, callback);
  }

  Promise.all(urlCheckPromises)
      .then(handleLookupResult);
};
