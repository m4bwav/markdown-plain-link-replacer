/*
Compile-time checks on the published declaration files. The runner copies this file into each TypeScript fixture as index.ts, so
it is checked under that fixture's module and resolution settings (ESM and CommonJS under nodenext, bundler, node10).
*/
import linkReplacer, {
  replacePlainLinks,
  type ReplacePlainLinksCallback,
  type ReplacePlainLinksOptions,
} from 'markdown-plain-link-replacer';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

// Compiles only when the argument is assignable to T.
declare function expectType<T>(value: T): void;

const options: ReplacePlainLinksOptions = {
  template: '[{{title}}]({{url}})',
  timeout: 5000,
  signal: AbortSignal.timeout(10_000),
};

const promised = replacePlainLinks('See https://example.com', options);
const promisedWithout = replacePlainLinks('See https://example.com');
const callback: ReplacePlainLinksCallback = markdown => {
  expectType<string>(markdown);
};

const called = replacePlainLinks('See https://example.com', callback);
const calledWithTemplate = replacePlainLinks('See https://example.com', callback, '{{title}}', {timeout: 1000});
expectType<typeof replacePlainLinks>(linkReplacer.replacePlainLinks);

// A wrapper passing a callback it may not have: the union overload accepts it.
declare const maybeCallback: ReplacePlainLinksCallback | undefined;
export const wrapped: void | Promise<string> = replacePlainLinks('x', maybeCallback);

// 1.1.16's order without a callback: the template in third place.
const oldOrder = replacePlainLinks('See https://example.com', undefined, '{{title}}');
const oldOrderNull = replacePlainLinks('See https://example.com', null, '{{title}}');

// A null or undefined markdown is accepted, and answered as it was given.
declare const maybeMarkdown: string | null | undefined;
const promisedMaybe = replacePlainLinks(maybeMarkdown);
const promisedNull = replacePlainLinks(null);
replacePlainLinks(maybeMarkdown, markdown => {
  expectType<string | null | undefined>(markdown);
});

export type Checks = [
  Expect<Equal<typeof oldOrder, Promise<string>>>,
  Expect<Equal<typeof oldOrderNull, Promise<string>>>,
  Expect<Equal<typeof promisedMaybe, Promise<string | null | undefined>>>,
  Expect<Equal<typeof promisedNull, Promise<null>>>,
  Expect<Equal<typeof promised, Promise<string>>>,
  Expect<Equal<typeof promisedWithout, Promise<string>>>,
  Expect<Equal<typeof called, void>>,
  Expect<Equal<typeof calledWithTemplate, void>>,
];

// @ts-expect-error -- the markdown is a string
void replacePlainLinks(42);

// @ts-expect-error -- the callback receives the markdown, a string
replacePlainLinks('x', (markdown: number) => markdown);

// @ts-expect-error -- timeout must be a number
void replacePlainLinks('x', {timeout: '5000'});

// @ts-expect-error -- the callback form takes its template as the third argument, not in the options
replacePlainLinks('x', callback, undefined, {template: '{{title}}'});
