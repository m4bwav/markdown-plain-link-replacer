# markdown-plain-link-replacer

[![Dependency Status](https://david-dm.org/m4bwav/markdown-plain-link-replacer.svg)](https://david-dm.org/m4bwav/markdown-plain-link-replacer)


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
