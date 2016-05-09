#!/usr/bin/env node
'use strict';
var meow = require('meow')
  , linkReplacer = require('./index.js')
  ;

var cli = meow({
	help: [
		'Usage',
		'  $ markdown-plain-link-replacer "<markdown>"',
		'',
		'Example',
		'  $ markdown-plain-link-replacer "  http://starwars.wikia.com/wiki/Bespin  "'
	]
});

var input = cli.input[0];

linkReplacer.replacePlainLinks(input, function(newMarkdown){
	console.log(newMarkdown);
});