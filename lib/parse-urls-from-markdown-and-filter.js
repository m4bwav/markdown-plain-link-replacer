var getUrls = require('get-urls');
var iterate = require('array-iterate');

module.exports = function (markdown, options) {
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
};
