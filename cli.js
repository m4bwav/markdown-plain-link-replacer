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

function executeLinkReplace(markdown) {
  linkReplacer.replacePlainLinks(markdown, function (newMarkdown) {
    console.log(newMarkdown);
  }, templateString);
}
var filePath = cli.flags.i;

if (filePath) {
  fs.readFile(filePath, 'utf8', function (secondInputErr, fileText) {
    executeLinkReplace(fileText);
  });
} else {
  executeLinkReplace(cli.input[0]);
}

