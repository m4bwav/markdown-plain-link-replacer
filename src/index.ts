// The entry of both builds: the named export, and a default export holding it, as 1.1.16's module.exports object did.
import {replacePlainLinks} from './replace-plain-links.js';

export {replacePlainLinks} from './replace-plain-links.js';
export type {ReplacePlainLinksCallback, ReplacePlainLinksOptions} from './replace-plain-links.js';

const markdownPlainLinkReplacer = {replacePlainLinks};
export default markdownPlainLinkReplacer;
