#!/usr/bin/env bash
# Protects the default branch with the ruleset in .github/rulesets/main.json and
# restricts merging to squash. Idempotent. Needs `gh` authenticated as a repo admin.
# GitHub Free + private repo: rulesets are unavailable; this script then fails with a hint.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
name="main-protection"

existing="$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name==\"$name\") | .id" 2>/dev/null | head -1 || true)"
if [ -n "$existing" ]; then
  method=PUT; url="repos/$repo/rulesets/$existing"
else
  method=POST; url="repos/$repo/rulesets"
fi

if ! gh api --method "$method" "$url" --input .github/rulesets/main.json >/dev/null; then
  echo "Could not apply the ruleset to $repo." >&2
  echo "Rulesets on private repositories need GitHub Pro, Team or Enterprise Cloud." >&2
  exit 1
fi

gh api --method PATCH "repos/$repo" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F allow_auto_merge=true -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=BLANK >/dev/null

echo "Protected $repo: PR required, squash only (title only, no body), linear history, 'build' check, Conventional Commits."
