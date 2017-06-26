#!/usr/bin/env node
'use strict';
const fs = require('fs');
const meow = require('meow');
const linkReplacer = require('./index.js');

const cli = meow({
  help: [
    'Usage',
    '  $ markdown-plain-link-replacer "<markdown>"',
    '',
    'Example',
    '  $ markdown-plain-link-replacer "  http://starwars.wikia.com/wiki/Bespin  "'
  ]
});

function executeCliLogic() {
  if (cli && cli.flags && cli.flags.h) {
    return;
  }

  const templateString = cli.flags.t;
  const filePath = cli.flags.i;

  function replaceLinksCallback(newMarkdown) {
    console.log(newMarkdown);
  }

  function executeLinkReplace(markdown, template) {
    linkReplacer.replacePlainLinks(markdown, replaceLinksCallback, template);
  }

  function afterFileReadExecuteLinkReplace(secondInputErr, fileText) {
    executeLinkReplace(fileText, templateString);
  }

  if (filePath) {
    fs.readFile(filePath, 'utf8', afterFileReadExecuteLinkReplace);
  } else {
    executeLinkReplace(cli.input[0], templateString);
  }
}
executeCliLogic();
