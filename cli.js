#!/usr/bin/env node
'use strict';
var fs = require('fs');
var meow = require('meow');
var linkReplacer = require('./index.js');

var cli = meow({
  help: [
    'Usage',
    '  $ markdown-plain-link-replacer "<markdown>"',
    '',
    'Example',
    '  $ markdown-plain-link-replacer "  http://starwars.wikia.com/wiki/Bespin  "'
  ]
});

if (cli && cli.flags && cli.flags.h) {
  return;
}

var templateString = cli.flags.t;

function replaceLinksCallback(newMarkdown) {
  console.log(newMarkdown);
}

function executeLinkReplace(markdown) {
  linkReplacer.replacePlainLinks(markdown, replaceLinksCallback, templateString);
}

function afterFileReadExecuteLinkReplace(secondInputErr, fileText) {
  executeLinkReplace(fileText);
}

var filePath = cli.flags.i;

if (filePath) {
  fs.readFile(filePath, 'utf8', afterFileReadExecuteLinkReplace);
} else {
  executeLinkReplace(cli.input[0]);
}

