# Handoff

<!-- Keep under 50 lines. Replace, never append. Written at the end of a work session so the next one starts without re-deriving state. -->

## Current state
**Done, 2026-09-27.** 2.0.0 is released as `latest` and VERIFIED (provenance, signatures, verify-published on Node 20-26 across three OSes). 2.0.0-beta.1 is on `next`. Mark deprecated 1.x with: "1.x is unmaintained; 2.0.0 is a TypeScript rewrite with the same answers, see the CHANGELOG". The repository has only master, no open pull requests, no webhooks and no alerts. Tag ruleset 24074613 is active. Lessons L-047 to L-054 are in the package-modernize skill (C-20260927-3 and -4), and the inventory row in package-modernization says Done.

## Left for Mark (the harness refused these as permission grants)
Double-click scripts/maintainer-settings.cmd (or run scripts/maintainer-settings.sh in Git Bash): master ruleset, repo options, secret scanning, vulnerability reporting, read-only workflow token. Re-runnable.

## Standing work (minimum upkeep)
- After 2026-09-30, optionally remove `--min-release-age=0` from ci.yml's `npm audit signatures` step.
- Dependabot pull requests: merge when CI is green. A new release follows AGENTS.md's release ritual.
