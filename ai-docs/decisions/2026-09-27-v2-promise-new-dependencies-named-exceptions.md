---
title: "v2 keeps 1.1.16's links, lookups and text except fourteen named exceptions, on Mark's three new majors"
kind: decision
status: accepted
date: 2026-09-27
verified: 2026-09-27
stale_after: never
tags: [v2, compatibility, golden, dependencies]
summary: "read before changing what 2.x replaces or depends on: the compatibility promise (same links, same lookups, same text as 1.1.16 except E1-E14), why titles follow get-title-at-url 3, and why url-regex, hogan.js and parse-domain are replaced"
---

# v2 promise: 1.1.16's answers except named exceptions, on the new dependencies

## Context

The golden capture of the published 1.1.16 (164 library and 18 CLI cases) showed crashes, silent loss of punctuation and links, whole-text HTML decoding and no timeout; three of the twelve runtime dependencies are Mark's own packages, now at new majors whose answers differ from their 1.x.

## Decision

2.0.0 finds the same links, looks up the same pages in the same order and writes the same text as the published 1.1.16 for every case in `test/golden/1.1.16.json`, except the exceptions E1 to E14 in the plan. Titles come from get-title-at-url 3; the golden test swaps 1.1.16's title for 3.x's mechanically, so every other byte stays under test. Dependencies: get-title-at-url ^3, is-an-image-url ^2, replace-string-at-position ^2, tldts ^7; the link scanner and the template renderer are inlined.

## Reasons

- No dependents, about 100 downloads a month, and the bugs mangle or lose the caller's text or crash the process: fixing them in the one name in a major is honest, and each fix is one changelog line.
- url-regex has a ReDoS with no patched version (GHSA-v4rh-8p82-6h5w); hogan.js pulls deprecated CLI packages for three template values; parse-domain 0.2.1 returns null for IPs and localhost.
- Mark's own packages were modernized first so this one could consume them.

## Rejected

- Keeping `replacePlainLinks` exact and adding the fixes under a new name: it would mean re-implementing request's and article-title's quirks and keeping the crashes.
- linkify-it for link detection: maintained, but it finds different links, so most golden cases would become exceptions.
- Keeping hogan.js: exact for every template, but ships deprecated transitive packages.

Related: builds on [../plans/2026-09-27-modernization-and-v2-release.md](../plans/2026-09-27-modernization-and-v2-release.md); see also [../notes/2026-09-27-phase-0-survey-baseline-and-capture.md](../notes/2026-09-27-phase-0-survey-baseline-and-capture.md).
