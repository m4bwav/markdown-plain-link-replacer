'use strict';

var getUrls = require('get-urls')
  , iterate = require('array-iterate')
  , isUrl = require('is-url')
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
  function geneneratePromiseForTitleLookup(url, options){
			 if(options.d && options.d.indexOf && options.d.indexOf("urlresponse")  !== -1){
				 console.log("Creating promise to find url: " + url);
			 }
	  
	 return new Promise(function(resolve, reject){
		 
		 getTitleAtUrl(url, function(title){
			 if(options.d && options.d.indexOf && options.d.indexOf("urlresponse")  !== -1){
				 console.log("title: " + title + " found for url: " + url);
			 }
			 
			 if(!title){
				 resolve();
				 return;
			 }
			 
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
  
  function filterValidUrlsAndLookupTitles(urls, markdown, options){
	  var titleLookupPromises = []
	    , relookupFailure = false
		, loweredMarkdown = markdown.toLowerCase()
		;
	  
	iterate(urls, function (currentUrl) {
		var urlIndexTracker = 0;
		
		if(options.d){
			  var nextIndexOf = loweredMarkdown.indexOf(currentUrl, urlIndexTracker);
			  if(nextIndexOf === -1){
				console.log("\nCould not find url: " + currentUrl + " that was previously found in the markdown during parsing, urlIndexTracker: " + urlIndexTracker);
			  }
		}
		while(loweredMarkdown.indexOf(currentUrl, urlIndexTracker) !== -1){
			var currentUrlIndex = urlIndexTracker;
			var currentUrlStart = loweredMarkdown.indexOf(currentUrl, currentUrlIndex);
			urlIndexTracker = currentUrlStart + currentUrl.length;
			
			
			if((currentUrlStart + currentUrl.length) < markdown.length){
				var endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
				var urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);
				
				if(!urlPlusOneChar.endsWith(")") && isUrl(urlPlusOneChar)){
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
			
			var titleLookupPromise = geneneratePromiseForTitleLookup(currentUrl, options);
			
			titleLookupPromises.push(titleLookupPromise);
			break;
		}
	});
	
	return titleLookupPromises;
  }
  function executeReplacePlainLinksWithTitles(urlTitleList, markdown, callback, options){
	iterate(urlTitleList, function (urlTitleMarkdownPair) {
		if(!urlTitleMarkdownPair){
			return true;
		}
		
		var currentUrl = urlTitleMarkdownPair.url
		  , urlIndexTracker = 0
		  ;
		  
		if(!currentUrl){
			return true;
		}
		
		if(options.d && options.d.indexOf && options.d.indexOf("replacement")  !== -1){
	      console.log("Attempting to replace url: " + currentUrl);
		  var nextIndexOf = markdown.indexOf(currentUrl, urlIndexTracker);
		  console.log("Next index of url: " + currentUrl + " is at position: " + nextIndexOf + " during replacement");
		}
		while(markdown.indexOf(currentUrl, urlIndexTracker) !== -1){
			var currentUrlIndex = urlIndexTracker;
			var currentUrlStart = markdown.indexOf(currentUrl, currentUrlIndex);
			 if(options.d && options.d.indexOf && options.d.indexOf("replacement")  !== -1){
			  console.log("Looking for url during replacement: " + currentUrl + " after position: " + currentUrlIndex);
			}
			if((currentUrlStart + currentUrl.length) < markdown.length){
				var endOfPlusOneUrl = currentUrlStart + currentUrl.length + 1;
				var urlPlusOneChar = markdown.substring(currentUrlStart, endOfPlusOneUrl);
				
				if(!urlPlusOneChar.endsWith(")") && isUrl(urlPlusOneChar)){
					urlIndexTracker = currentUrlStart + currentUrl.length;
					if(options.d && options.d.indexOf && options.d.indexOf("replacement")  !== -1){
					  console.log("Skipping replacement of url: " + currentUrl + " for short version of url.");
					}
					continue;
				}
				
				if(currentUrlStart > 2){
					var precendingString = markdown.substring(currentUrlStart - 2, 2);
					
					if(precendingString === "]("){
						urlIndexTracker = currentUrlStart + currentUrl.length;
						if(options.d && options.d.indexOf && options.d.indexOf("replacement")  !== -1){
						  console.log("Skipping replacement of url: " + currentUrl + "  for ]( prefix.");
						}
						continue;
					}
				}
				
				if(currentUrlStart > 3){
					var precendingString = markdown.substring(currentUrlStart - 3, 3);
					
					if(precendingString === "]: "){
						urlIndexTracker = currentUrlStart + currentUrl.length;
						if(options.d && options.d.indexOf && options.d.indexOf("replacement")  !== -1){
						  console.log("Skipping replacement of url: " + currentUrl + " for ]: prefix.");
						}
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
  
  function getUrlsAndFilter(markdown, options){
	var urls = getUrls(markdown, {stripWWW: false, stripFragment: false, normalizeProtocol: false, removeQueryParameters: []})
	  , outputResults = []
	  ;
	  
			if(options.d && options.d.indexOf && options.d.indexOf("urlread")  !== -1){
				console.log("getUrls output:");
				console.log(urls);
			}
	iterate(urls, function (currentUrl) {
		if(!currentUrl){
			return true;
		}
		
		if(currentUrl.endsWith(")") && currentUrl.indexOf("(") === -1){
			currentUrl = currentUrl.substring(0, currentUrl.length - 1);
			if(options.d && options.d.indexOf && options.d.indexOf("urlread")  !== -1){
				console.log("new url: " + currentUrl);
			  }
		}
		
		if(currentUrl.toLowerCase().endsWith(".jpg")){
			if(options.d && options.d.indexOf && options.d.indexOf("urlread")  !== -1){
				console.log("skipping url: " + currentUrl);
			}
			return true;
		}
		if(outputResults.indexOf(currentUrl) === -1){
			
			if(options.d && options.d.indexOf && options.d.indexOf("urlread")  !== -1){
				console.log("pushing url: " + currentUrl);
			}
		  outputResults.push(currentUrl.toLowerCase());
		}
	});
	  
	  return outputResults;
  }
exports.replacePlainLinks = function(markdown, callback, options){
	if(!markdown){
		callback(markdown);
		return;
	}
	
	var urls = getUrlsAndFilter(markdown, options)
	  , lookupPromises = filterValidUrlsAndLookupTitles(urls, markdown, options)
	  ;
	
	
	Promise.all(lookupPromises)
	  .then(function(res){
			  console.log(res);
			if(options.d && options.d.indexOf && options.d.indexOf("promisecomplete")  !== -1){
			  console.log(res);
			}
		  executeReplacePlainLinksWithTitles(res, markdown, callback, options);
	  });
	
};