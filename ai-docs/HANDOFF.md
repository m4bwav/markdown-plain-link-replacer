# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
Phase 0 of the package-modernize run is done (2026-09-27): survey, baseline, golden capture of the published 1.1.16 (`test/golden/`), everlast doc set, AGENTS.md. Findings: `ai-docs/notes/2026-09-27-phase-0-survey-baseline-and-capture.md`.

## In progress
Phase 1 written: `ai-docs/plans/2026-09-27-modernization-and-v2-release.md` (D1-D15, exceptions E1-E14) and `ai-docs/decisions/2026-09-27-v2-promise-new-dependencies-named-exceptions.md` (proposed). Stop: waiting for Mark's rulings.

## Decisions made this session
None ruled yet. Recommended: fix the bugs in `replacePlainLinks` as named exceptions; titles follow get-title-at-url 3 (swapped mechanically in the golden test); url-regex, hogan.js and parse-domain replaced (inlined scanner, inlined renderer, tldts).

## Dead ends hit
- The old suite cannot be a baseline: xo 0.18 crashes on Node 24 and ava's tests fetch live pages whose titles changed.
- request refuses a non-ASCII or emoji path, so those two capture cases make no request.

## Next single action
Take Mark's rulings on the plan's decisions table (first-hand, one question, if a new session: skill L-022), mark the decision record accepted, then start Phase 2 on branch v2 with the golden test.
