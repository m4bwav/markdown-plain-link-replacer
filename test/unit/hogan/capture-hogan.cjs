'use strict';
// Records hogan.js 3.0.2's output (the template engine of markdown-plain-link-replacer 1.1.16) for the templates in
// template.test.js's oracle list, so the 2.x renderer can be checked against it without hogan.js as a dependency.
// Run in a scratch project, never inside the repository: npm init -y && npm install hogan.js@3.0.2
//   node capture-hogan.cjs > hogan-3.0.2.json
// Each entry: the template, the values, and hogan's output or the message of what it threw.

const hogan = require('hogan.js');

// Values replacePlainLinks can produce (a page title, the link as written, its site), so template.test.js can check every
// entry through the public function.
const values = [
  {title: 'Page', url: 'http://www.example.com/page', source: 'example.com'},
  {title: 'Tom & Jerry <3 "q" \'s\'', url: 'http://www.example.com/a?b=1&c=2', source: 'example.com'},
  {title: 'x', url: 'https://someone.github.io/p', source: 'someone.github.io'},
  {title: '{{url}} $& $1 \\ `x`', url: 'http://www.example.com/{{title}}', source: 'example.com'},
];

const templates = [
  '[{{title}}]({{url}}) from {{source}}',
  '"[{{title}}]({{url}})", *{{source}}*',
  '{{title}}',
  '{{{title}}}',
  '{{&title}}',
  '{{ title }}',
  '{{{ title }}}',
  '{{& title }}',
  '[{{{title}}}]({{{url}}})',
  'fixed text',
  '',
  '{{nope}}|{{title}}',
  '{{#title}}yes{{/title}}',
  '{{^title}}no title{{/title}}',
  '{{#title}}[{{.}}]{{/title}}',
  '{{.}}',
  '{{#source}}{{title}} ({{source}}){{/source}}',
  '{{! a comment }}{{title}}',
  'a {{!comment}} b',
  '{{#title}}\n{{title}}\n{{/title}}\n',
  'line\n  {{#title}}  \nin\n  {{/title}}\nafter',
  '{{#title}}\r\n{{title}}\r\n{{/title}}\r\n',
  '{{title}}\n{{#url}}\n- {{url}}\n{{/url}}',
  '{{#title}}{{#url}}{{title}}@{{url}}{{/url}}{{/title}}',
  '{{^nope}}{{title}}{{/nope}}',
  '{{#nope}}hidden{{/nope}}shown',
  '$& {{title}} $1',
  '}} {{title}} {',
  '{title} {{title}}',
  '{{title}}{{url}}{{source}}',
  '{{title.length}}',
  '{{{title}}} and {{title}}',
  // Lines of several section and comment tags (Phase 3 review nit 5).
  '{{^nope}}{{/nope}}\r\n{{&source}}',
  '{{! a }}  {{! b }}  \n{{title}}',
  '{{#url}}{{/url}} ',
  '{{#title}}{{title}}{{/title}}\n{{url}}',
  ' \t{{#title}}\t{{^nope}} \n{{title}}\n{{/nope}}{{/title}}\n',
  '{{! two\nlines }}  \n{{title}}',
  ' {{#title}}\n{{title}}\n{{/title}}',
  '\r{{#title}}\r\n{{title}}{{/title}}',
  'a {{#title}}{{/title}}\n{{title}}',
];

const entries = [];
for (const template of templates) {
  for (const value of values) {
    let entry;
    try {
      entry = {template, values: value, output: hogan.compile(template).render(value)};
    } catch (error) {
      entry = {template, values: value, error: error.message};
    }

    entries.push(entry);
  }
}

process.stdout.write(`${JSON.stringify({engine: `hogan.js@${require('hogan.js/package.json').version}`, entries}, null, '\t')}\n`);
