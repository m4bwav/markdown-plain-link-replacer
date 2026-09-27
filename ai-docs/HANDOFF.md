# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
Phases 0 to 3 done (2026-09-27). Every Phase 3 review finding is fixed or recorded (commits 5851240 to 7146f05; see the log). The summary is posted on pull request #12 (https://github.com/m4bwav/markdown-plain-link-replacer/pull/12#issuecomment-5852474375). CI run 36293018870 is green on every job. 400 tests: 396 pass and 4 run in a child process. Coverage is 100 percent, and the golden files are unchanged since 87e88c6.

## Waiting on (2026-09-27, after Mark merged #12 as a3cbe55)
- Phase 4 cleanup: ai-docs/notes/dispositions.tsv is written (close #4-#11 with comments and delete their branches, delete branch snyk-fix-a1249a24, delete webhooks Snyk x2 and Travis) plus `--tag-ruleset`. The agent's permission check blocked even the dry run of post-merge-cleanup.sh; it needs Mark's explicit go or his own run. Dependabot alerts: 0 open. The pre-merge ruleset step lapsed because the merge came first.
- Phase 5: `preflight-tag-npm.sh 2.0.0-beta.1` printed READY on master; next `npm version 2.0.0-beta.1 && git push --follow-tags origin master`, then Mark approves the staged beta on npmjs.com.

## Decisions made this session
- E18: an `@` more than 256 characters after the scheme is part of the path (plan, CHANGELOG, test).
- 1.1.16's larger-URL rule is restored, with E4's punctuation allowed only when it ends the link. Rule details are in the log entry for 2026-09-27.
- Accepted without a number: 1.1.16 replacing a short link inside a longer one. An offline differential against the published 1.1.16 found no other class.

## Dead ends hit
Heredocs and `python -c` still eat backslashes; use Edit. The random differential needs whole-link seeds, or almost no links form.

## Next single action
After Mark's review, start Phase 4: a ruleset before the merge, then the cleanup list in the plan's appendix as ai-docs/notes/dispositions.tsv. The Dependabot alert on url-regex (master's 1.1.16 manifest) closes when v2 merges. Remove `--min-release-age=0` from ci.yml after 2026-09-30 if wanted.
