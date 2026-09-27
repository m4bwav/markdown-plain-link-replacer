import {scanLinks} from './scan-links.js';

/**
A plain link found in markdown: its position, the text as written (after trimming), and the URL to look up.
*/
export type FoundLink = {
  start: number;
  end: number;
  /**
  The link as written in the markdown.
  */
  text: string;
  /**
  The URL to request: the link with HTML character references decoded, when it is http or https; else undefined.
  */
  url: string | undefined;
};

// Characters that end a sentence or wrap a link rather than belong to it (plan E4). A closing bracket is trimmed only when the
// link holds fewer opening ones, so https://en.wikipedia.org/wiki/Bent_(band) keeps its parenthesis.
const TRAILING = new Set(['.', ',', ';', ':', '!', '?', '\'', '*', '~', '`']);
const PAIRS: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
  '>': '<',
};
const CLOSING = new Set(Object.keys(PAIRS));

// What may follow a link as written. 1.1.16 left a link followed by any other character alone as "a smaller part of a larger
// URL" (a host followed by `_v2/docs`, a one-digit port), which keeps the scanner from splitting a URL it cannot read whole.
// It allowed only whitespace and `)`. E4 adds `"` (left alone in isInLinkContext) and a run of the punctuation and closing
// brackets it trims when whitespace or the end follows the run (`example.com, and`, not the port in `example.com:8/x`).
function isLinkBoundary(text: string, index: number): boolean {
  if (text[index] === ')') {
    return true;
  }

  for (let at = index; ; at++) {
    const character = text[at];
    if (character === undefined || character === '"' || /\s/u.test(character)) {
      return true;
    }

    if (!TRAILING.has(character) && !CLOSING.has(character)) {
      return false;
    }
  }
}

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

const REFERENCES = /&(?:#(?<decimal>\d{1,7})|#[Xx](?<hex>[\dA-Fa-f]{1,6})|(?<name>amp|lt|gt|quot|apos));/gu;
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\'',
};

// A link written in markdown source can carry character references (`?a=1&amp;b=2`); the request uses the characters.
function decodeReferences(text: string): string {
  return text.replaceAll(REFERENCES, (whole: string, ...rest: unknown[]) => {
    const groups = rest.at(-1) as {decimal?: string; hex?: string; name?: string};
    if (groups.name !== undefined) {
      return NAMED[groups.name]!;
    }

    const code = groups.decimal === undefined ? Number.parseInt(groups.hex!, 16) : Number(groups.decimal);
    return code > 0 && code <= 0x10_FF_FF && (code < 0xD8_00 || code > 0xDF_FF) ? String.fromCodePoint(code) : whole;
  });
}

type Range = [number, number];
type Line = {start: number; end: number; text: string};

const FENCE = /^ {0,3}(?<marker>`{3,}|~{3,})/u;
const LIST_ITEM = /^ {0,3}(?:[*+-]|\d{1,9}[).])(?:[\t ]|$)/u;

function splitLines(markdown: string): Line[] {
  const lines: Line[] = [];
  let lineStart = 0;
  for (const match of markdown.matchAll(/\r\n|\n|\r/gu)) {
    lines.push({start: lineStart, end: match.index, text: markdown.slice(lineStart, match.index)});
    lineStart = match.index + match[0].length;
  }

  lines.push({start: lineStart, end: markdown.length, text: markdown.slice(lineStart)});
  return lines;
}

// The marker of a line that opens a fenced code block. A backtick fence's info string cannot hold a backtick (that line is a
// code span instead).
function fenceOpening(text: string): string | undefined {
  const opening = FENCE.exec(text);
  const marker = opening?.groups?.marker;
  const isCodeSpan = marker?.startsWith('`') === true && text.slice(opening![0].length).includes('`');
  return isCodeSpan ? undefined : marker;
}

// Whether a line closes the fence opened by `marker`: the same character, at least as many, and nothing else on the line.
function isFenceClose(text: string, marker: string): boolean {
  const closing = FENCE.exec(text)?.groups?.marker;
  return closing !== undefined && closing.startsWith(marker[0]!) && closing.length >= marker.length && text.trim() === closing;
}

// Fenced and indented code blocks, and the indexes of the prose lines. An indented block counts only after a blank line, and
// not inside a list: an approximation of CommonMark that errs towards treating text as prose.
function codeBlocks(lines: Line[], markdownLength: number): {blocks: Range[]; prose: number[]} {
  const blocks: Range[] = [];
  const prose: number[] = [];
  let fence: {marker: string; start: number} | undefined;
  let isPreviousBlank = true;
  let lastProse = '';
  let isInIndented = false;
  for (const [lineIndex, line] of lines.entries()) {
    if (fence) {
      if (isFenceClose(line.text, fence.marker)) {
        blocks.push([fence.start, line.end]);
        fence = undefined;
        isPreviousBlank = false;
        lastProse = '';
      }

      continue;
    }

    const marker = fenceOpening(line.text);
    if (marker !== undefined) {
      fence = {marker, start: line.start};
      isInIndented = false;
      continue;
    }

    const isBlank = line.text.trim() === '';
    const isIndented = !isBlank && /^(?: {4}|\t)/u.test(line.text);
    if (isIndented && (isInIndented || (isPreviousBlank && !LIST_ITEM.test(lastProse) && !/^\s/u.test(lastProse)))) {
      blocks.push([line.start, line.end]);
      isInIndented = true;
      isPreviousBlank = false;
      continue;
    }

    if (!isBlank) {
      isInIndented = false;
      lastProse = line.text;
      prose.push(lineIndex);
    }

    isPreviousBlank = isBlank;
  }

  if (fence) {
    blocks.push([fence.start, markdownLength]);
  }

  return {blocks, prose};
}

// Code spans in one paragraph: a run of backticks up to the next run of the same length. Each run's closer is found through
// the list of runs of its length, so the search stays linear.
function codeSpans(paragraph: string, offset: number): Range[] {
  const spans: Range[] = [];
  const runs = Array.from(paragraph.matchAll(/`+/gu), match => ({start: match.index, end: match.index + match[0].length}));
  const byLength = new Map<number, number[]>();
  for (const [runIndex, run] of runs.entries()) {
    const length = run.end - run.start;
    const list = byLength.get(length);
    if (list) {
      list.push(runIndex);
    } else {
      byLength.set(length, [runIndex]);
    }
  }

  const cursor = new Map<number, number>();
  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const run = runs[runIndex]!;
    const length = run.end - run.start;
    const list = byLength.get(length)!;
    let at = cursor.get(length) ?? 0;
    while (at < list.length && list[at]! <= runIndex) {
      at++;
    }

    cursor.set(length, at);
    const closer = list[at];
    if (closer === undefined) {
      continue;
    }

    spans.push([offset + run.start, offset + runs[closer]!.end]);
    runIndex = closer;
  }

  return spans;
}

/**
The parts of the markdown that are code (plan E7): fenced blocks, indented blocks and code spans, sorted by start.
*/
export function codeRanges(markdown: string): Range[] {
  const lines = splitLines(markdown);
  const {blocks, prose} = codeBlocks(lines, markdown.length);
  const ranges = [...blocks];
  // Code spans live within a paragraph: consecutive prose lines.
  for (let index = 0; index < prose.length;) {
    let last = index;
    while (last + 1 < prose.length && prose[last + 1] === prose[last]! + 1) {
      last++;
    }

    const from = lines[prose[index]!]!.start;
    ranges.push(...codeSpans(markdown.slice(from, lines[prose[last]!]!.end), from));
    index = last + 1;
  }

  return ranges.toSorted((a, b) => a[0] - b[0]);
}

// `ranges` sorted by start and not overlapping.
function isInside(ranges: Range[], position: number): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
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

// Whether a link is one to leave alone (plan E8, and what 1.1.16 left): already a link target, an autolink, a reference
// definition, an HTML attribute value, or followed by a double quote.
function isInLinkContext(before: string, after: string | undefined): boolean {
  return after === '"'
    || (after === '>' && before.endsWith('<'))
    || /\]\(<?$/u.test(before)
    || /\]:[\t ]*<?$/u.test(before)
    || /<[a-z][^<>]*\s[\w\-:]+[\t ]*=[\t ]*["']?$/iu.test(before);
}

/**
The plain links in `markdown` that 2.x may replace, in order. A link is left alone (and never requested) when it is:
- already the target of a markdown link or image (`](url`), an autolink (`<url>`), or a reference definition (`[1]: url`);
- an HTML attribute value, or followed by a double quote (1.1.16 left those too);
- in a code span or code block;
- without an http or https scheme (`www.example.com`, `//example.com`, `ftp://`);
- followed by a character that is not whitespace, punctuation E4 trims, a closing bracket or `"` (part of a larger URL).
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
    if (!isLinkBoundary(markdown, rawEnd)) {
      continue;
    }

    const end = trimEnd(markdown, start, rawEnd, hostEnd);
    for (; scanned < start; scanned++) {
      const character = markdown[scanned];
      if (character === '\n' || character === '\r') {
        lineStart = scanned + 1;
      }
    }

    // The contexts need only the characters just before the link.
    const before = markdown.slice(Math.max(lineStart, start - 64), start);
    if (isInLinkContext(before, markdown[end]) || isInside(code, start)) {
      continue;
    }

    const text = markdown.slice(start, end);
    const url = decodeReferences(text);
    found.push({
      start,
      end,
      text,
      url: /^https?:\/\//iu.test(url) ? url : undefined,
    });
  }

  return found;
}
