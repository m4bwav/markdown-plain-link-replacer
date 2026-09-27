# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
2026-09-27: phases 0 to 5 done. #12 was merged as a3cbe55. The cleanup ran with Mark's go: PRs #4-#11 closed with comments, only the master branch left, 0 webhooks, tag ruleset 24074613 ("Tags only by admins") active, 0 Dependabot alerts. 2.0.0-beta.1 is published under dist-tag `next` and VERIFIED by verify-registry-npm.sh. v2.0.0 is tagged (28a125e, changelog dated 2026-09-27), and release.yml succeeded, so it is staged on npm.

## Waiting on
Mark approves the staged 2.0.0 on npmjs.com with 2FA.

## Next single action
1. `bash ../package-modernize/skills/package-modernize/scripts/verify-registry-npm.sh markdown-plain-link-replacer 2.0.0 m4bwav/markdown-plain-link-replacer` (argument order: package, version, repo).
2. Mark deprecates 1.x in his own terminal, with the message typed exactly:
   `npm deprecate markdown-plain-link-replacer@"<2.0.0" "1.x is unmaintained; 2.0.0 is a TypeScript rewrite with the same answers, see the CHANGELOG"`
   Then read it back: `npm view markdown-plain-link-replacer@1.1.16 deprecated`.
3. Phase 7: inventory row in package-modernization, lessons into the skill (see the log), kickoff record corrected. Remove `--min-release-age=0` from ci.yml after 2026-09-30 if wanted.

## Dead ends hit
- verify-registry-npm.sh takes PACKAGE VERSION [REPO]. Passing the version first gives a 404.
- Mark's own run of post-merge-cleanup.sh from PowerShell failed with "gh: command not found": PowerShell's `bash` is not Git Bash. Run the scripts from the agent's Bash tool.
- The auto-mode classifier blocked GitHub writes until "Bash" was added to permissions.allow in ~/.claude/settings.json (2026-09-27). An autoMode prose entry for GitHub writes was refused as self-modification.
