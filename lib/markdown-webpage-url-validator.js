const isUrl = require('is-url');

function isUrlInAEndOfFileReference(currentUrlStart, markdown) {
  if (currentUrlStart > 3) {
    const precendingString = markdown.substring(currentUrlStart - 3, currentUrlStart);

    if (precendingString === ']: ') {
      return true;
    }
  }

  return false;
}

function isUrlASmallerPartOfALargerUrl(currentUrlStart, currentUrl, markdown) {
  if ((currentUrlStart + currentUrl.length) < markdown.length) {
    const endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
    const urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);

    if (!urlPlusOneChar.endsWith(')') && isUrl(urlPlusOneChar)) {
      return true;
    }
  }

  return false;
}

function isUrlAlreadyLinkified(currentUrlStart, markdown) {
  if (currentUrlStart > 2) {
    const positionTwoCharactersBack = currentUrlStart - 2;
    const twoCharPrecendingString = markdown.substring(positionTwoCharactersBack, currentUrlStart);

    if (twoCharPrecendingString === '](') {
      return true;
    }
  }

  return false;
}

function isUrlValidWithinMarkdown(currentUrlIndex, currentUrl, markdown) {
  const currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);

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

module.exports = {isUrlValidWithinMarkdown};
