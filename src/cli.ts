#!/usr/bin/env node
import {Buffer} from 'node:buffer';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import process from 'node:process';
import {parseArgs} from 'node:util';
import {replacePlainLinks} from './replace-plain-links.js';

const HELP = `
  Replace plain links in markdown with titled links: each page is requested,
  and its title and site replace the bare URL.

  Usage
    $ markdown-plain-link-replacer "<markdown>"
    $ markdown-plain-link-replacer -i notes.md > notes-linked.md
    $ cat notes.md | markdown-plain-link-replacer

  Options
    -i, --input <file>      Read the markdown from a file ("-" for stdin)
    -t, --template <text>   A mustache template for each link, with {{title}},
                            {{url}} and {{source}} (HTML-escaped; {{{title}}}
                            is not). Default: "[{{title}}]({{url}})", *{{source}}*
    --timeout <ms>          Wait this long for each page (default 10000)
    -h, --help              Show this help
    -v, --version           Show the version

  With no markdown argument and no -i, the markdown is read from stdin.
  The result goes to stdout. Links whose page fails or has no title are
  left as they are.

  Exit codes
    0  the markdown was printed
    1  bad arguments, or the input could not be read

  Example
    $ markdown-plain-link-replacer "Source: https://example.com"
    Source: "[Example Domain](https://example.com)", *example.com*
`;

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Uint8Array);
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        input: {type: 'string', short: 'i'},
        template: {type: 'string', short: 't'},
        timeout: {type: 'string'},
        help: {type: 'boolean', short: 'h'},
        version: {type: 'boolean', short: 'v'},
      },
    });
  } catch (error) {
    console.error(`error: ${(error as Error).message}`);
    console.error('Run markdown-plain-link-replacer --help for the usage.');
    return 1;
  }

  const {values, positionals} = parsed;
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  if (values.version) {
    // A relative require inside the package reaches package.json without going through the exports map.
    const {version} = createRequire(import.meta.url)('../package.json') as {version: string};
    console.log(version);
    return 0;
  }

  let timeout: number | undefined;
  if (values.timeout !== undefined) {
    timeout = Number(values.timeout);
    if (values.timeout.trim() === '' || !Number.isFinite(timeout) || timeout <= 0) {
      console.error(`error: --timeout takes a positive number of milliseconds, not ${JSON.stringify(values.timeout)}`);
      return 1;
    }
  }

  let markdown: string;
  const source = values.input ?? positionals[0];
  try {
    if (values.input !== undefined && values.input !== '-') {
      markdown = await readFile(values.input, 'utf8');
    } else if (source === '-' || (source === undefined && !process.stdin.isTTY)) {
      markdown = await readStdin();
    } else if (source === undefined) {
      console.error('error: give the markdown as an argument, a file with -i, or on stdin');
      console.error('Run markdown-plain-link-replacer --help for the usage.');
      return 1;
    } else {
      // As 1.1.16 did: the first positional argument is the markdown, the rest are ignored.
      markdown = source;
    }
  } catch (error) {
    const {code, message} = error as NodeJS.ErrnoException;
    console.error(`error: cannot read ${values.input}: ${code ?? message}`);
    return 1;
  }

  try {
    const result = await replacePlainLinks(markdown, {template: values.template, timeout});
    // Printed with console.log, as 1.1.16 printed its result.
    console.log(result);
    return 0;
  } catch (error) {
    const {name, message} = error as Error;
    console.error(`${name}: ${message}`);
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
