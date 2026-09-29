# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
**Done, 2026-09-27.** 2.0.0 is released as `latest` and VERIFIED (provenance, signatures, verify-published on Node 20-26 across three OSes). 2.0.0-beta.1 is on `next`. Mark deprecated 1.x with: "1.x is unmaintained; 2.0.0 is a TypeScript rewrite with the same answers, see the CHANGELOG". The repository has only master, no open pull requests, no webhooks and no alerts. Tag ruleset 24074613 is active. Lessons L-047 to L-054 are in the package-modernize skill (C-20260927-3 and -4), and the inventory row in package-modernization says Done.

## Repository settings
Applied by Mark with scripts/maintainer-settings.cmd on 2026-09-27 and read back: branch ruleset 24077472 on master, homepage, wiki and projects off, delete-branch-on-merge, secret scanning and push protection, private vulnerability reporting, read-only workflow token. The wiki was switched on again for the GitHub wiki (2026-09-28).

## Wiki
Published 2026-09-29 (wiki commit ab33614, 10 pages, wikiwright 0.4.0). How to update it at the next release: ai-docs/notes/2026-09-29-github-wiki.md, with the verification script and its outputs beside it.

## For the next release (from the wiki run; the note has the details)
- README and `--help`: the string given as the default template is not the default when passed with `-t` (a user template HTML-escapes the title). README: falsy markdown also includes `0`, `false`, `NaN`; the CLI adds a trailing newline.
- CHANGELOG 2.0.0: "164 calls" should be 154.
- AGENTS.md: the capture's guard does not refuse plain http sockets (net.connect passes an array); the recording is unaffected.
- npm (Mark): `next` still points to 2.0.0-beta.1, which carries the 1.x deprecation message.

## Standing work (minimum upkeep)
- After 2026-09-30, optionally remove `--min-release-age=0` from ci.yml's `npm audit signatures` step.
- Dependabot pull requests: merge when CI is green. A new release follows AGENTS.md's release ritual.
