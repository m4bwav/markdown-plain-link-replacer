# markdown-plain-link-replacer

[![npm package](https://nodei.co/npm/markdown-plain-link-replacer.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/markdown-plain-link-replacer/)

[![Build Status](https://img.shields.io/travis/m4bwav/markdown-plain-link-replacer/master.svg)](https://travis-ci.org/m4bwav/markdown-plain-link-replacer)
[![Dependency Status](https://david-dm.org/m4bwav/markdown-plain-link-replacer.svg)](https://david-dm.org/m4bwav/markdown-plain-link-replacer)
[![Coverage Status](https://img.shields.io/coveralls/m4bwav/markdown-plain-link-replacer/master.svg)](https://coveralls.io/github/m4bwav/markdown-plain-link-replacer?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/npm/markdown-plain-link-replacer/badge.svg?style=flat-square)](https://snyk.io/test/npm/markdown-plain-link-replacer)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![Gitter](https://badges.gitter.im/m4bwav/markdown-plain-link-replacer.svg)](https://gitter.im/m4bwav/markdown-plain-link-replacer?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)


Script to replace a plain text link (ie http://whatever) with the title at the link's webpage in markdown.


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
```


## License

MIT © [Mark Rogers](http://www.markdavidrogers.com)
