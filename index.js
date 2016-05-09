'use strict';

var getUrls = require('get-urls')
  , iterate = require('array-iterate')
  , isUrl = require('is-url')
  , articleTitle = require('article-title')
  , getTitleAtUrl = require('get-title-at-url')
  , Promise = require("Promise")
  , parseDomain = require("parse-domain")
  , exports = module.exports = {}
  ;

 function replaceLinkAtPosition(markdown, urlTitleMarkdownPair, position){
	 var linkToReplace = urlTitleMarkdownPair.url
	   , newLinkMarkdown = urlTitleMarkdownPair.titleMarkdown
       , linkLength = linkToReplace.length
	   , prefix = markdown.substring(0, position)
	   , afterStartPosition = position + linkLength
	   , postfix = markdown.substring(afterStartPosition, markdown.length)
	   , result = prefix + newLinkMarkdown + postfix
	   ;
	 
	 return result;
 }
  function generateTitleMarkdown(url, title, source){
	  return '"[' + title + '](' + url + ')", *' + source + '*';
  }
  function geneneratePromiseForTitleLookup(url){
	 return new Promise(function(resolve, reject){
		 var title = getTitleAtUrl(url, function(title){
			 var domainData = parseDomain(url)
			   , source = domainData.domain + "." + domainData.tld
			   , urlTitleMarkdownPair = {
				 url: url,
				 titleMarkdown: generateTitleMarkdown(url, title, source)
			 };
			 
			 resolve(urlTitleMarkdownPair);
		 });
	  });
	  
	  
  }
  
  function filterValidUrlsAndLookupTitles(urls, markdown){
	  var titleLookupPromises = [];
	  
	iterate(urls, function (currentUrl) {
		var urlIndexTracker = 0;
		
		while(markdown.indexOf(currentUrl, urlIndexTracker) !== -1){
			var currentUrlIndex = urlIndexTracker;
			var currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
			urlIndexTracker = currentUrlStart + currentUrl.length;
			
			
			if((currentUrlStart + currentUrl.length) < markdown.length){
				var endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
				var urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);
				
				if(isUrl(urlPlusOneChar)){
					continue;
				}
				
				if(currentUrlStart > 2){
					var precendingString = markdown.substring(currentUrlStart - 2, 2);
					
					if(precendingString === "]("){
						continue;
					}
				}
				
				if(currentUrlStart > 3){
					var precendingString = markdown.substring(currentUrlStart - 3, 3);
					
					if(precendingString === "]: "){
						continue;
					}
				}
			}
			
			var titleLookupPromise = geneneratePromiseForTitleLookup(currentUrl);
			
			titleLookupPromises.push(titleLookupPromise);
			
		}
	});
	
	return titleLookupPromises;
  }
  function executeReplacePlainLinksWithTitles(urlTitleList, markdown, callback, options){
	
	iterate(urlTitleList, function (urlTitleMarkdownPair) {
		var currentUrl = urlTitleMarkdownPair.url
		  , urlIndexTracker = 0
		  ;
		
		while(markdown.indexOf(currentUrl, urlIndexTracker) !== -1){
			var currentUrlIndex = urlIndexTracker;
			var currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
			
			if((currentUrlStart + currentUrl.length) < markdown.length){
				var endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
				var urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);
				
				if(isUrl(urlPlusOneChar)){
					urlIndexTracker = currentUrlStart + currentUrl.length;
					continue;
				}
				
				if(currentUrlStart > 2){
					var precendingString = markdown.substring(currentUrlStart - 2, 2);
					
					if(precendingString === "]("){
						urlIndexTracker = currentUrlStart + currentUrl.length;
						continue;
					}
				}
				
				if(currentUrlStart > 3){
					var precendingString = markdown.substring(currentUrlStart - 3, 3);
					
					if(precendingString === "]: "){
						urlIndexTracker = currentUrlStart + currentUrl.length;
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
exports.replacePlainLinks = function(markdown, callback, options){
	var urls = getUrls(markdown)
	  , lookupPromises = filterValidUrlsAndLookupTitles(urls, markdown)
	  ;
	
	Promise.all(lookupPromises)
	  .then(function(res){
		  executeReplacePlainLinksWithTitles(res, markdown, callback, options);
	  });
	
};