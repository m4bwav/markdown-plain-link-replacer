/*
Finds link-like text the way url-regex 4.1.1 (strict mode, the regex 1.1.16 used) did, without its regular expression, which
backtracks catastrophically on crafted input (GHSA-v4rh-8p82-6h5w, no fixed version). The expression was:

  (?:(?:[a-z]+:)?//|www\.)(?:\S+(?::\S*)?@)?(?:localhost|<IPv4>|<host><domain><tld>)(?::\d{2,5})?(?:[/?#][^\s"]*)?

case-insensitive and global, where a host or domain label is `(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+` and the
top-level domain is `\.[a-z\u00a1-\uffff]{2,}\.?`. This scanner returns the same matches, leftmost first, with the same
priorities the regex engine used (the longest user-info part that leaves a valid host, the most domain labels that leave a
top-level domain, the longest top-level domain). Two bounds keep it linear where the regex was not: the user-info part is
looked for within the 256 characters after the scheme, and a host name longer than 256 characters is not a link (DNS names
stop at 253). test/unit/scan-links.test.js compares it with url-regex 4.1.1's expression on generated text.
*/

const AUTH_WINDOW = 256;
const HOST_MAX = 256;
const IPV4 = /(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}/uy;

/**
One match: `start` and `end` index the text; `hostEnd` is where the host name (without a trailing dot) ends, so trimming never
cuts into it.
*/
export type RawLink = {start: number; end: number; hostEnd: number};

// JavaScript's \s.
function isSpace(code: number): boolean {
  return code === 0x20 || (code >= 0x09 && code <= 0x0D) || code === 0xA0 || code === 0x16_80 || (code >= 0x20_00 && code <= 0x20_0A)
    || code === 0x20_28 || code === 0x20_29 || code === 0x20_2F || code === 0x20_5F || code === 0x30_00 || code === 0xFE_FF;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 0x61 && code <= 0x7A) || (code >= 0x41 && code <= 0x5A);
}

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

// [a-z\u00a1-\uffff0-9] with the i flag, per UTF-16 code unit as the regex (no u flag) saw it.
function isLabelChar(code: number): boolean {
  return isAsciiLetter(code) || isDigit(code) || code >= 0xA1;
}

// [a-z\u00a1-\uffff] with the i flag.
function isTldChar(code: number): boolean {
  return isAsciiLetter(code) || code >= 0xA1;
}

class Scanner {
  readonly #text: string;
  readonly #length: number;
  // The index of the next whitespace at or after each position, and of the last '@' before each position (-1 for none).
  readonly #nextSpace: Int32Array;
  readonly #previousAt: Int32Array;
  // What rest() answered for a position after a scheme: -2 not yet asked, -1 no match, else the match's end and host end.
  readonly #restEnd: Int32Array;
  readonly #restHostEnd: Int32Array;

  constructor(text: string) {
    this.#text = text;
    this.#length = text.length;
    const n = text.length;
    this.#nextSpace = new Int32Array(n + 1);
    this.#previousAt = new Int32Array(n + 1);
    this.#nextSpace[n] = n;
    for (let index = n - 1; index >= 0; index--) {
      this.#nextSpace[index] = isSpace(text.charCodeAt(index)) ? index : this.#nextSpace[index + 1]!;
    }

    this.#previousAt[0] = -1;
    for (let index = 1; index <= n; index++) {
      this.#previousAt[index] = text.charCodeAt(index - 1) === 0x40 ? index - 1 : this.#previousAt[index - 1]!;
    }

    this.#restEnd = new Int32Array(n + 1).fill(-2);
    this.#restHostEnd = new Int32Array(n + 1);
  }

  * links(): Generator<RawLink> {
    const text = this.#text;
    let index = 0;
    // The letters before a `://`: every start inside one run of letters reaches the same scheme end.
    let runEnd = -1;
    while (index < this.#length) {
      let found: RawLink | undefined;
      const code = text.charCodeAt(index);
      if (isAsciiLetter(code)) {
        if (index >= runEnd) {
          runEnd = index;
          while (runEnd < this.#length && isAsciiLetter(text.charCodeAt(runEnd))) {
            runEnd++;
          }
        }

        if (text.startsWith('://', runEnd)) {
          found = this.#rest(index, runEnd + 3);
        }
      } else if (code === 0x2F && text.charCodeAt(index + 1) === 0x2F) {
        found = this.#rest(index, index + 2);
      }

      if (!found && (code === 0x77 || code === 0x57) && text.slice(index, index + 4).toLowerCase() === 'www.') {
        found = this.#rest(index, index + 4);
      }

      if (found) {
        yield found;
        index = found.end;
        runEnd = -1;
      } else {
        index++;
      }
    }
  }

  // The part after the scheme (or `www.`): optional user info, the host, an optional port and path.
  #rest(start: number, from: number): RawLink | undefined {
    let end = this.#restEnd[from]!;
    if (end === -2) {
      const result = this.#restUncached(from);
      this.#restEnd[from] = result ? result.end : -1;
      this.#restHostEnd[from] = result ? result.hostEnd : 0;
      end = this.#restEnd[from]!;
    }

    return end === -1 ? undefined : {start, end, hostEnd: this.#restHostEnd[from]!};
  }

  #restUncached(from: number): {end: number; hostEnd: number} | undefined {
    const text = this.#text;
    let host: {end: number; hostEnd: number} | undefined;
    // `\S+(?::\S*)?@`: the regex's greedy \S+ tries the last '@' first, then earlier ones, and at least one character must
    // come before it.
    const windowEnd = Math.min(from + AUTH_WINDOW, this.#nextSpace[from]!);
    for (let at = this.#previousAt[windowEnd]!; at > from; at = this.#previousAt[at]!) {
      host = this.#host(at + 1);
      if (host) {
        break;
      }
    }

    host ??= this.#host(from);
    if (!host) {
      return undefined;
    }

    let {end} = host;
    // `(?::\d{2,5})?`
    if (text.charCodeAt(end) === 0x3A) {
      let digits = 0;
      while (digits < 5 && isDigit(text.charCodeAt(end + 1 + digits))) {
        digits++;
      }

      if (digits >= 2) {
        end += 1 + digits;
      }
    }

    // `(?:[/?#][^\s"]*)?`
    if ([0x2F, 0x3F, 0x23].includes(text.charCodeAt(end))) {
      end++;
      const stop = this.#nextSpace[end]!;
      while (end < stop && text.charCodeAt(end) !== 0x22) {
        end++;
      }
    }

    return {end, hostEnd: host.hostEnd};
  }

  // `localhost`, an IPv4 address, or a host name ending in a top-level domain; `end` includes the optional trailing dot.
  #host(from: number): {end: number; hostEnd: number} | undefined {
    const text = this.#text;
    if (text.slice(from, from + 9).toLowerCase() === 'localhost') {
      return {end: from + 9, hostEnd: from + 9};
    }

    IPV4.lastIndex = from;
    const ip = IPV4.exec(text);
    if (ip) {
      return {end: from + ip[0].length, hostEnd: from + ip[0].length};
    }

    // The labels: runs of label characters and hyphens, split by dots.
    const limit = Math.min(this.#length, from + HOST_MAX + 1);
    const labels: Array<{start: number; end: number}> = [];
    let position = from;
    for (;;) {
      const labelStart = position;
      while (position < limit && (isLabelChar(text.charCodeAt(position)) || text.charCodeAt(position) === 0x2D)) {
        position++;
      }

      if (position >= limit && limit < this.#length) {
        // Longer than a host name can be.
        return undefined;
      }

      labels.push({start: labelStart, end: position});
      if (text.charCodeAt(position) !== 0x2E) {
        break;
      }

      position++;
    }

    // A full label, followed by a dot, starting and ending with a label character.
    const isFullLabel = (index: number): boolean => {
      const label = labels[index]!;
      return index < labels.length - 1 && label.end > label.start
        && isLabelChar(text.charCodeAt(label.start)) && isLabelChar(text.charCodeAt(label.end - 1));
    };

    if (!isFullLabel(0)) {
      return undefined;
    }

    let domains = 0;
    while (1 + domains < labels.length && isFullLabel(1 + domains)) {
      domains++;
    }

    for (let count = domains; count >= 0; count--) {
      const tld = labels[1 + count];
      if (!tld) {
        continue;
      }

      let tldEnd = tld.start;
      while (tldEnd < tld.end && isTldChar(text.charCodeAt(tldEnd))) {
        tldEnd++;
      }

      if (tldEnd - tld.start >= 2) {
        return {end: text.charCodeAt(tldEnd) === 0x2E ? tldEnd + 1 : tldEnd, hostEnd: tldEnd};
      }
    }

    return undefined;
  }
}

/**
Every match of url-regex 4.1.1 in `text`, in order.
*/
export function scanLinks(text: string): RawLink[] {
  return [...new Scanner(text).links()];
}
