# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
Phases 0 to 2 done (2026-09-27). Plan ruled: every recommendation, plus A1 (CLI stdin) and A2 (README "what it requests"). Branch v2 pushed; pull request #12 open (https://github.com/m4bwav/markdown-plain-link-replacer/pull/12); CI run 36286840573 green on every job. 400 tests, 396 pass, 4 run in a child process; coverage 100 percent; golden files unchanged since 87e88c6.

## In progress
Phase 3: the review is back: 3 bugs, 1 risk, 3 nits and test gaps, all in `ai-docs/notes/2026-09-27-phase-3-review-findings.md`. None is fixed yet. The worst: the 1.1.16 rule that skipped a link followed by a non-space character (other than `)`) was lost, so 2.x splits URLs such as `http://example.com_v2/docs`.

## Decisions made this session
- All in the plan (D1-D15, E1-E17, A1-A2) and the accepted decision record. E15 (credential links left), E16 (Promise form) and E17 (throwing callback is the caller's uncaught exception) were added during Phase 2 and are on the pull request's "For review" list.
- The golden test takes old titles from the recording, not from article-title (D1 deviation, in the log).
- The lockfile holds only the maintainer's three new majors past the three-day cooldown; ci.yml's `npm audit signatures` passes `--min-release-age=0` until they are older (remove the flag after 2026-09-30 if wanted).

## Dead ends hit
See the log: the canary on an untracked src/, `--min-release-age=0` on a multi-package install, xo --fix and Promise.withResolvers, the 256-character host cap that made crafted input slow under c8. All are skill lessons L-047 to L-051.

## Next single action
Work through the findings note in order: fix bugs 1 to 3 with tests first, then add E18 (the auth window) to the plan and CHANGELOG, then the nits and the test gaps. After each fix, run the golden test, `npm run test:dist` on Node 24 and 20, and lint with the cache cleared, checking each result before committing. Then post the review's summary on pull request #12 and stop for Mark's review of the pull request. Then Phase 4 (ruleset before the merge, the cleanup list in the plan's appendix as ai-docs/notes/dispositions.tsv).
