import {scanLinks} from './scan-links.js';

/**
A plain link found in markdown: its position, the text as written (after trimming), and the URL to look up.
*/
export type FoundLink = {
  start: number;
  end: number;
  /** The link as written in the markdown. */
  text: string;
  /** The URL to request: the link with HTML character references decoded, when it is http or https; else undefined. */
  url: string | undefined;
};

// Characters that end a sentence or wrap a link rather than belong to it (plan E4). A closing bracket is trimmed only when the
// link holds fewer opening ones, so https://en.wikipedia.org/wiki/Bent_(band) keeps its parenthesis.
const TRAILING = new Set(['.', ',', ';', ':', '!', '?', '\'', '*', '~', '`']);
const PAIRS: Record<string, string> = {')': '(', ']': '[', '}': '{', '>': '<'};

function trimEnd(text: string, start: number, end: number, hostEnd: number): number {
  let trimmed = end;
  // 1.1.16 trimmed whitespace the host name allowed (the regex's label class reaches U+3000 and other spaces).
  while (trimmed > hostEnd && /\s/u.test(text[trimmed - 1]!)) {
    trimmed--;
  }

  // The brackets in the link, counted once and updated as characters come off the end.
  const counts = new Map<string, number>();
  for (let index = start; index < trimmed; index++) {
    const character = text[index]!;
    if ('()[]{}<>'.includes(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }

  while (trimmed > hostEnd) {
    const last = text[trimmed - 1]!;
    const opening = PAIRS[last];
    if (!TRAILING.has(last) && (opening === undefined || (counts.get(opening) ?? 0) >= (counts.get(last) ?? 0))) {
      break;
    }

    counts.set(last, (counts.get(last) ?? 0) - 1);
    trimmed--;
  }

  return trimmed;
}

const REFERENCES = /&(?:#(\d{1,7})|#[xX]([\da-fA-F]{1,6})|(amp|lt|gt|quot|apos|#39));/gu;
const NAMED: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: '\''};

// A link written in markdown source can carry character references (`?a=1&amp;b=2`); the request uses the characters.
function decodeReferences(text: string): string {
  return text.replaceAll(REFERENCES, (whole, decimal?: string, hex?: string, name?: string) => {
    if (name) {
      return name === '#39' ? '\'' : NAMED[name]!;
    }

    const code = decimal === undefined ? Number.parseInt(hex!, 16) : Number.parseInt(decimal, 10);
    return code > 0 && code <= 0x10_FF_FF && (code < 0xD8_00 || code > 0xDF_FF) ? String.fromCodePoint(code) : whole;
  });
}

type Range = [number, number];

const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/u;

// The parts of the markdown that are code (plan E7): fenced blocks, indented blocks and code spans. An approximation of
// CommonMark that errs towards treating text as prose: an indented block counts only after a blank line, and not inside a list.
export function codeRanges(markdown: string): Range[] {
  const ranges: Range[] = [];
  const lines: Array<{start: number; end: number; text: string}> = [];
  const lineBreak = /\r\n|\n|\r/gu;
  let lineStart = 0;
  for (const match of markdown.matchAll(lineBreak)) {
    lines.push({start: lineStart, end: match.index, text: markdown.slice(lineStart, match.index)});
    lineStart = match.index + match[0].length;
  }

  lines.push({start: lineStart, end: markdown.length, text: markdown.slice(lineStart)});

  // Prose lines, as indexes into `lines`.
  const prose: number[] = [];
  let fence: {marker: string; start: number} | undefined;
  let previousBlank = true;
  let lastProse = '';
  let inIndented = false;
  for (const [lineIndex, line] of lines.entries()) {
    const blank = line.text.trim() === '';
    if (fence) {
      const closing = FENCE.exec(line.text);
      if (closing && closing[1]![0] === fence.marker[0] && closing[1]!.length >= fence.marker.length && line.text.trim() === closing[1]) {
        ranges.push([fence.start, line.end]);
        fence = undefined;
        previousBlank = false;
        lastProse = '';
      }

      continue;
    }

    const opening = FENCE.exec(line.text);
    if (opening && !(opening[1]![0] === '`' && line.text.slice(opening[0].length).includes('`'))) {
      fence = {marker: opening[1]!, start: line.start};
      inIndented = false;
      continue;
    }

    const indented = /^(?: {4}|\t)/u.test(line.text) && !blank;
    if (indented && (inIndented || (previousBlank && !LIST_ITEM.test(lastProse) && !/^\s/u.test(lastProse)))) {
      ranges.push([line.start, line.end]);
      inIndented = true;
      previousBlank = false;
      continue;
    }

    if (!blank) {
      inIndented = false;
      lastProse = line.text;
      prose.push(lineIndex);
    }

    previousBlank = blank;
  }

  if (fence) {
    ranges.push([fence.start, markdown.length]);
  }

  // Code spans: a run of backticks up to the next run of the same length, within the prose (not across a code block).
  for (let index = 0; index < prose.length;) {
    // A paragraph: consecutive prose lines.
    let last = index;
    while (last + 1 < prose.length && prose[last + 1] === prose[last]! + 1) {
      last++;
    }

    const from = lines[prose[index]!]!.start;
    const to = lines[prose[last]!]!.end;
    const paragraph = markdown.slice(from, to);
    // Every run of backticks, and for each length the runs of that length in order, so each opener finds its closer at once.
    const runs: Array<{start: number; end: number}> = [];
    for (const match of paragraph.matchAll(/`+/gu)) {
      runs.push({start: match.index, end: match.index + match[0].length});
    }

    const byLength = new Map<number, number[]>();
    for (const [runIndex, run] of runs.entries()) {
      const length = run.end - run.start;
      const list = byLength.get(length) ?? [];
      list.push(runIndex);
      byLength.set(length, list);
    }

    const cursor = new Map<number, number>();
    for (let runIndex = 0; runIndex < runs.length; runIndex++) {
      const run = runs[runIndex]!;
      const length = run.end - run.start;
      const list = byLength.get(length)!;
      // The position of this run in its list only moves forward, as runIndex does.
      let at = cursor.get(length) ?? 0;
      while (list[at]! <= runIndex) {
        at++;
      }

      cursor.set(length, at);
      const closer = list[at];
      if (closer !== undefined) {
        ranges.push([from + run.start, from + runs[closer]!.end]);
        runIndex = closer;
      }
    }

    index = last + 1;
  }

  return ranges.sort((a, b) => a[0] - b[0]);
}

// `ranges` sorted by start and not overlapping.
function inside(ranges: Range[], position: number): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const [start, end] = ranges[middle]!;
    if (position < start) {
      high = middle - 1;
    } else if (position >= end) {
      low = middle + 1;
    } else {
      return true;
    }
  }

  return false;
}

/**
The plain links in `markdown` that 2.x may replace, in order. A link is left alone (and never requested) when it is:
- already the target of a markdown link or image (`](url`), an autolink (`<url>`), or a reference definition (`[1]: url`);
- an HTML attribute value, or followed by a double quote (1.1.16 left those too);
- in a code span or code block;
- without an http or https scheme (`www.example.com`, `//example.com`, `ftp://`).
*/
export function findLinks(markdown: string): FoundLink[] {
  const found: FoundLink[] = [];
  const raw = scanLinks(markdown);
  if (raw.length === 0) {
    return found;
  }

  const code = codeRanges(markdown);
  // The start of the current line, moved forward with the links, so a long line stays linear.
  let lineStart = 0;
  let scanned = 0;
  for (const {start, end: rawEnd, hostEnd} of raw) {
    const end = trimEnd(markdown, start, rawEnd, hostEnd);
    const text = markdown.slice(start, end);
    for (; scanned < start; scanned++) {
      const character = markdown[scanned];
      if (character === '\n' || character === '\r') {
        lineStart = scanned + 1;
      }
    }

    // The contexts below need only the characters just before the link.
    const before = markdown.slice(Math.max(lineStart, start - 64), start);
    const after = markdown[end];
    if (
      /\]\(<?$/u.test(before)
      || /\]:[ \t]*<?$/u.test(before)
      || (before.endsWith('<') && after === '>')
      || /=[ \t]*["']?$/u.test(before)
      || after === '"'
      || inside(code, start)
    ) {
      continue;
    }

    const url = decodeReferences(text);
    found.push({start, end, text, url: /^https?:\/\//iu.test(url) ? url : undefined});
  }

  return found;
}
