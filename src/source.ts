import {getDomain, getHostname} from 'tldts';

/**
The site a link belongs to, for `{{source}}`: its registrable domain from the Public Suffix List, private suffixes included
(`www.example.co.uk` is example.co.uk, `someone.github.io` stays someone.github.io), as parse-domain 0.2.1 named it in 1.1.16.
Where there is none (an IP address, `localhost`, a one-label host) it is the host name, where 1.1.16 crashed (plan E2).
*/
export function sourceOf(url: string): string {
  return getDomain(url, {allowPrivateDomains: true}) ?? getHostname(url) ?? '';
}
