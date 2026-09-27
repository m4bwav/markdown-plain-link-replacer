import {getTitleAtUrl} from 'get-title-at-url';
import {isAnImageUrl} from 'is-an-image-url';
import replaceStringAtPosition from 'replace-string-at-position';
import {findLinks} from './find-links.js';
import {sourceOf} from './source.js';
import {compileTemplate, defaultTemplate, type Template} from './template.js';

/**
Options for `replacePlainLinks`.
*/
export type ReplacePlainLinksOptions = {
  /**
  A mustache template for each replaced link, with `{{title}}`, `{{url}}` and `{{source}}` (HTML-escaped; `{{{title}}}` is
  not). Default: `"[{{title}}]({{url}})", *{{source}}*` with the title's markdown characters escaped instead.
  */
  template?: string;
  /**
  Milliseconds to wait for each page, for the image check and for the title. Default 10000.
  */
  timeout?: number;
  /**
  Stops every lookup: the Promise rejects with the signal's reason, and a callback gets the markdown unchanged.
  */
  signal?: AbortSignal;
};

/**
Called once with the new markdown.
*/
export type ReplacePlainLinksCallback = (markdown: string) => void;

const DEFAULT_TIMEOUT = 10_000;
// The largest delay setTimeout accepts; longer ones fire at once.
const MAX_TIMEOUT = 2_147_483_647;
// 1.1.16 started the title lookups 100 ms apart, so a text with many links to one site does not hit it all at once.
const STAGGER = 100;

type Settings = {template: Template; timeout: number; signal: AbortSignal | undefined};

function describe(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return String(value);
  }

  return typeof value === 'function' ? 'a function' : (Array.isArray(value) ? 'an array' : 'an object');
}

function settingsFrom(options: ReplacePlainLinksOptions | undefined, template: unknown): Settings {
  if (options !== undefined && (options === null || typeof options !== 'object')) {
    throw new TypeError(`options must be an object, not ${describe(options)}`);
  }

  let compiled = defaultTemplate;
  // 1.1.16: an empty, null or undefined template means the default.
  if (template !== undefined && template !== null && template !== '') {
    if (typeof template !== 'string') {
      throw new TypeError(`template must be a string, not ${describe(template)}`);
    }

    compiled = compileTemplate(template);
  }

  let timeout = DEFAULT_TIMEOUT;
  if (options?.timeout !== undefined) {
    if (typeof options.timeout !== 'number' || Number.isNaN(options.timeout) || options.timeout <= 0) {
      throw new TypeError(`timeout must be a positive number of milliseconds, not ${describe(options.timeout)}`);
    }

    timeout = Math.min(options.timeout, MAX_TIMEOUT);
  }

  const signal = options?.signal;
  if (signal !== undefined && (signal === null || typeof signal !== 'object' || typeof signal.addEventListener !== 'function')) {
    throw new TypeError('signal must be an AbortSignal');
  }

  return {template: compiled, timeout, signal};
}

function textOf(markdown: unknown): string | undefined {
  if (!markdown) {
    return undefined;
  }

  if (typeof markdown === 'string') {
    return markdown;
  }

  if (markdown instanceof String) {
    return markdown.valueOf();
  }

  throw new TypeError(`markdown must be a string, not ${describe(markdown)}`);
}

const sleep = async (ms: number, signal: AbortSignal | undefined) => new Promise<void>(resolve => {
  if (ms === 0 || signal?.aborted) {
    resolve();
    return;
  }

  const onAbort = () => {
    clearTimeout(timer);
    resolve();
  };

  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  signal?.addEventListener('abort', onAbort, {once: true});
});

async function titleFor(url: string, delay: number, settings: Settings): Promise<string | undefined> {
  await sleep(delay, settings.signal);
  if (settings.signal?.aborted) {
    return undefined;
  }

  const result = await getTitleAtUrl(url, {timeout: settings.timeout, signal: settings.signal});
  // The result is {title} or {error} with the title undefined; a title is never empty.
  return result.title;
}

async function replaceIn(markdown: string, settings: Settings): Promise<string> {
  const links = findLinks(markdown);
  // Each URL is looked up once, however often it appears.
  const urls = [...new Set(links.map(link => link.url).filter(url => url !== undefined))];
  const imageAnswers = await Promise.all(urls.map(async url => isAnImageUrl(url, {timeout: settings.timeout, signal: settings.signal})));
  const pages = urls.filter((_url, index) => imageAnswers[index] === false);
  const titles = new Map<string, string>();
  await Promise.all(pages.map(async (url, index) => {
    const title = await titleFor(url, index * STAGGER, settings);
    if (title !== undefined) {
      titles.set(url, title);
    }
  }));
  settings.signal?.throwIfAborted();

  let result = markdown;
  // From the end, so the positions of the links before stay valid.
  for (const link of links.toReversed()) {
    const title = link.url === undefined ? undefined : titles.get(link.url);
    if (title === undefined) {
      continue;
    }

    const replacement = settings.template({title, url: link.text, source: sourceOf(link.url!)});
    result = replaceStringAtPosition(result, link.text, replacement, link.start);
  }

  return result;
}

/**
Replaces each plain http or https link in `markdown` with a titled link: it requests the page, and when the page is HTML
with a title, writes `"[Title](url)", *site*` (or the template) in place of the link. Images, links that are already
markdown links, autolinks, reference definitions, HTML attributes and code are left alone, and so is any link whose page
fails, times out or has no title. Nothing else in the text changes.

With a callback, calls it once, after returning, with the new markdown. Without one, returns a Promise of it. A falsy
`markdown` (`''`, `null`, `undefined`) is answered as it is: a callback at once, or a resolved Promise.

Throws a TypeError, before any request, when `markdown` is neither a string nor falsy, the callback is neither a function nor
an options object, the template is not a string or uses a mustache feature it does not support, or `timeout` or `signal`
has the wrong type.
*/
export function replacePlainLinks(markdown: string, callback: ReplacePlainLinksCallback, template?: string | null, options?: Omit<ReplacePlainLinksOptions, 'template'>): void;
export function replacePlainLinks(markdown: string, options?: ReplacePlainLinksOptions): Promise<string>;
export function replacePlainLinks(
  markdown: string,
  callbackOrOptions?: ReplacePlainLinksCallback | ReplacePlainLinksOptions | null,
  template?: string | null,
  options?: Omit<ReplacePlainLinksOptions, 'template'>,
): Promise<string> | void;
export function replacePlainLinks(
  markdown: string,
  callbackOrOptions?: ReplacePlainLinksCallback | ReplacePlainLinksOptions | null,
  template?: string | null,
  options?: Omit<ReplacePlainLinksOptions, 'template'>,
): Promise<string> | void {
  if (typeof callbackOrOptions === 'function') {
    const callback = callbackOrOptions;
    const settings = settingsFrom(options, template);
    const text = textOf(markdown);
    if (text === undefined) {
      // 1.1.16 answered a falsy markdown at once, with the same value.
      callback(markdown);
      return;
    }

    // The callback runs outside the promise chain, so an exception it throws is the caller's uncaught exception, as a
    // callback's would be, and is never reported as a rejection.
    // An abort (the only rejection) gives the callback the text unchanged.
    replaceIn(text, settings)
      .then(result => {
        queueMicrotask(() => {
          callback(result);
        });
      })
      .catch(() => {
        queueMicrotask(() => {
          callback(text);
        });
      });
    return;
  }

  if (callbackOrOptions !== undefined && callbackOrOptions !== null && typeof callbackOrOptions !== 'object') {
    throw new TypeError(`the second argument must be a callback or an options object, not ${describe(callbackOrOptions)}`);
  }

  const promiseOptions = callbackOrOptions ?? undefined;
  // A template in third place with no callback, 1.1.16's argument order, is used.
  const settings = settingsFrom(promiseOptions, promiseOptions?.template ?? template);
  const text = textOf(markdown);
  return text === undefined ? Promise.resolve(markdown) : replaceIn(text, settings);
}
