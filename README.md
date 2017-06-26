# markdown-plain-link-replacer

[![npm package](https://nodei.co/npm/markdown-plain-link-replacer.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/markdown-plain-link-replacer/)

[![Build Status](https://img.shields.io/travis/m4bwav/markdown-plain-link-replacer/master.svg)](https://travis-ci.org/m4bwav/markdown-plain-link-replacer)
[![Dependency Status](https://david-dm.org/m4bwav/markdown-plain-link-replacer.svg)](https://david-dm.org/m4bwav/markdown-plain-link-replacer)
[![Coverage Status](https://img.shields.io/coveralls/m4bwav/markdown-plain-link-replacer/master.svg)](https://coveralls.io/github/m4bwav/markdown-plain-link-replacer?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/m4bwav/markdown-plain-link-replacer/badge.svg)](https://snyk.io/test/github/m4bwav/markdown-plain-link-replacer)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![Gitter](https://badges.gitter.im/m4bwav/markdown-plain-link-replacer.svg)](https://gitter.im/m4bwav/markdown-plain-link-replacer?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)


Script to replace a plain text link (ie http://whatever) with a linked title to the link's webpage in markdown.
`Source: http://www.google.com` would become `Source: "[Google](http://www.google.com)", *google.com*`, although a template 
can be used if desired. 


## Installation

Installation is easiest through npm:

`npm install markdown-plain-link-replacer --save`


## Usage

**markdown-plain-link-replacer** can be included as reference.

```
var linkReplacer = require('markdown-plain-link-replacer')
  , input = "  http://starwars.wikia.com/wiki/Bespin  "
  ;

linkReplacer.replacePlainLinks(input, function(newMarkdown){
  //newMarkdown: '  "[Bespin](http://starwars.wikia.com/wiki/Bespin)", *wikia.com*  '
	console.log(newMarkdown);
});
```
   
   
   
The replacePlainLinks method has the following signature `replacePlainLinks(inputMarkdown, calllback, [hoganTemplate])`.
The hogan template is optional and uses the hogan.js templating engine to style the new markdown.
For example, a template = `[{{title}}]({{url}}) from {{source}}` will produce 
`[Google](http://www.google.com) from google.com` 
for url http://www.google.com.  The default template is `"[{{title}}]({{url}})", *{{source}}*`


## CLI

```
$ npm install --global markdown-plain-link-replacer
```

```
$ markdown-plain-link-replacer --help

  Usage
    $ markdown-plain-link-replacer "<markdown>"

  Example
    $ markdown-plain-link-replacer "  http://starwars.wikia.com/wiki/Bespin  "
  
  File input example with custom template
    $ markdown-plain-link-replacer -i "sample.md" -t "[{{title}}]({{url}}) from {{source}}"
```
  
  
The cli can take a `-i` argument for file input, and `-t` argument for passing in a hogan template string.


## License

MIT © [Mark Rogers](http://www.markdavidrogers.com)
