'use strict';

module.exports = function replaceLinksInString(markdown, urlTitleMarkdownPair, position) {
  var linkToReplace = urlTitleMarkdownPair.url;
  var newLinkMarkdown = urlTitleMarkdownPair.titleMarkdown;
  var linkLength = linkToReplace.length;
  var prefix = markdown.substring(0, position);
  var afterStartPosition = position + linkLength;
  var postfix = markdown.substring(afterStartPosition, markdown.length);
  var result = prefix + newLinkMarkdown + postfix;

  return result;
};
