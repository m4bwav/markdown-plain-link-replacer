#!/usr/bin/env bash
# Repository settings the agent may not apply (its harness refuses them as permission grants). Run once, as the maintainer,
# from Git Bash (or double-click maintainer-settings.cmd). Safe to re-run: skips the branch ruleset if one exists.
set -euo pipefail
export PATH="/c/Program Files/GitHub CLI:$PATH"
R=m4bwav/markdown-plain-link-replacer

echo "== Branch ruleset on master (copied from get-title-at-url 24003504)"
if gh api "repos/$R/rulesets" --jq '.[].target' | grep -qx branch; then
  echo "a branch ruleset already exists; skipped"
else
  gh api repos/m4bwav/get-title-at-url/rulesets/24003504 --jq '{name,target,enforcement,conditions,bypass_actors,rules}' \
    | gh api -X POST "repos/$R/rulesets" --input - --jq '"ruleset \(.id) \(.name) \(.enforcement)"'
fi

echo "== Repository options"
gh repo edit "$R" --homepage https://www.npmjs.com/package/markdown-plain-link-replacer \
  --enable-wiki=false --enable-projects=false --delete-branch-on-merge

echo "== Secret scanning and push protection"
gh api -X PATCH "repos/$R" -f 'security_and_analysis[secret_scanning][status]=enabled' \
  -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled' --jq '.security_and_analysis'

echo "== Private vulnerability reporting"
gh api -X PUT "repos/$R/private-vulnerability-reporting"

echo "== Workflow token read-only"
gh api -X PUT "repos/$R/actions/permissions/workflow" -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false

echo "Done."
