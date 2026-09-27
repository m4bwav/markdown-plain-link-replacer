# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
**Done, 2026-09-27.** 2.0.0 is released as `latest` and VERIFIED (provenance, signatures, verify-published on Node 20-26 across three OSes). 2.0.0-beta.1 is on `next`. Mark deprecated 1.x with: "1.x is unmaintained; 2.0.0 is a TypeScript rewrite with the same answers, see the CHANGELOG". The repository has only master, no open pull requests, no webhooks and no alerts. Tag ruleset 24074613 is active. Lessons L-047 to L-054 are in the package-modernize skill (C-20260927-3 and -4), and the inventory row in package-modernization says Done.

## Left for Mark (the harness refused these as permission grants)
Run from Git Bash:
~~~
R=m4bwav/markdown-plain-link-replacer
gh api repos/m4bwav/get-title-at-url/rulesets/24003504 --jq '{name,target,enforcement,conditions,bypass_actors,rules}' | gh api -X POST repos/$R/rulesets --input -
gh repo edit $R --homepage https://www.npmjs.com/package/markdown-plain-link-replacer --enable-wiki=false --enable-projects=false --delete-branch-on-merge
gh api -X PATCH repos/$R -f 'security_and_analysis[secret_scanning][status]=enabled' -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
gh api -X PUT repos/$R/private-vulnerability-reporting
gh api -X PUT repos/$R/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
~~~

## Standing work (minimum upkeep)
- After 2026-09-30, optionally remove `--min-release-age=0` from ci.yml's `npm audit signatures` step.
- Dependabot pull requests: merge when CI is green. A new release follows AGENTS.md's release ritual.
