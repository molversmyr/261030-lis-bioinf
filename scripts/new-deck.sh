#!/usr/bin/env bash
# Create a new private deck repo from the template, initialize it, and protect main.
# Usage: DECK_TEMPLATE=<owner>/deck-template new-deck.sh <name> <reveal|impress>
# Optional: DECK_NODE_CHANNEL=lts (default: latest), DECK_NO_PROTECT=1 (skip branch protection)
set -euo pipefail

usage() { echo "Usage: DECK_TEMPLATE=<owner>/deck-template $0 <name> <reveal|impress>" >&2; exit 1; }

name="${1:-}"
framework="${2:-}"
[[ -n "$name" && ( "$framework" == "reveal" || "$framework" == "impress" ) ]] || usage
[[ -n "${DECK_TEMPLATE:-}" ]] || { echo "Set DECK_TEMPLATE=<owner>/deck-template" >&2; exit 1; }

gh repo create "$name" --template "$DECK_TEMPLATE" --private --clone
cd "$name"

# Prefer local Node (18+); otherwise run the init script in a throwaway container.
if command -v node >/dev/null 2>&1; then
  node scripts/init.mjs "$framework"
else
  docker run --rm --user "$(id -u):$(id -g)" -e DECK_NODE_CHANNEL -v "$PWD":/w -w /w node:lts-slim node scripts/init.mjs "$framework"
fi

git add -A
git commit -m "chore: initialize $framework deck"
git push   # must happen BEFORE protection is applied: main will not accept direct pushes afterwards

if [[ "${DECK_NO_PROTECT:-}" != "1" ]]; then
  ./scripts/protect.sh || echo "WARNING: main is NOT protected (see message above). Fix the plan issue, then run scripts/protect.sh." >&2
fi

echo "Done. Open $PWD in VS Code and choose 'Reopen in Container'."
if command -v code >/dev/null 2>&1; then code .; fi
