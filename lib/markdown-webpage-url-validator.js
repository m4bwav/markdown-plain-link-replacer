var isUrl = require('is-url');
var exports = module.exports = {}
  ;

function isUrlInAEndOfFileReference(currentUrlStart, markdown) {
  if (currentUrlStart > 3) {
    var precendingString = markdown.substring(currentUrlStart - 3, currentUrlStart);

    if (precendingString === ']: ') {
      return true;
    }
  }

  return false;
}

function isUrlASmallerPartOfALargerUrl(currentUrlStart, currentUrl, markdown) {
  if ((currentUrlStart + currentUrl.length) < markdown.length) {
    var endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
    var urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);

    if (!urlPlusOneChar.endsWith(')') && isUrl(urlPlusOneChar)) {
      return true;
    }
  }

  return false;
}

function isUrlAlreadyLinkified(currentUrlStart, markdown) {
  if (currentUrlStart > 2) {
    var positionTwoCharactersBack = currentUrlStart - 2;
    var twoCharPrecendingString = markdown.substring(positionTwoCharactersBack, currentUrlStart);

    if (twoCharPrecendingString === '](') {
      return true;
    }
  }

  return false;
}

function isUrlValidWithinMarkdown(currentUrlIndex, currentUrl, markdown) {
  var currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);

  if (isUrlASmallerPartOfALargerUrl(currentUrlStart, currentUrl, markdown)) {
    return false;
  }

  if (isUrlAlreadyLinkified(currentUrlStart, markdown)) {
    return false;
  }

  if (isUrlInAEndOfFileReference(currentUrlStart, markdown)) {
    return false;
  }

  return true;
}

exports.isUrlValidWithinMarkdown = isUrlValidWithinMarkdown;
