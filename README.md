# 261030-lis-bioinf

Framework: **reveal.js** | Node 26.12.1 | npm 12.2.1 (pinned in `.deck.json`)

## Work on it

1. Open the folder in VS Code and choose **Reopen in Container**.
2. `npm run dev` and open http://localhost:5173
3. Edit index.html and src/main.js; styles are in `src/theme.css`.

## Commits and branch protection

`main` is protected: no direct pushes, no force-push, squash merges only, the `build` check must pass,
and every commit message must follow Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`).
A local hook (commitlint) checks each commit; GitHub enforces the same rule on `main`.

```bash
git switch -c feat/roadmap-slide
git commit -m "feat: add roadmap slide"
git push -u origin HEAD
gh pr create --title "feat: add roadmap slide" --template content.md   # title = commit on main
# templates: content.md, fix.md, chore.md (or omit --template for the default)
gh pr merge --squash --auto
```

Commit from inside the devcontainer (the hook needs the installed dependencies).

## Build

`npm run build` writes a static, relocatable site to `dist/`.
CI uploads it as the `deck` artifact on every push (Actions tab).

## Re-pin Node/npm

`node scripts/init.mjs --refresh-node` (set `DECK_NODE_CHANNEL=lts` for LTS), then rebuild the container.

## Publish (optional, read first)

On every plan except GitHub Enterprise Cloud, a GitHub Pages site is public even if this repository is private.
Do not enable Pages for confidential decks. To enable it deliberately:
`gh api -X POST repos/<owner>/261030-lis-bioinf/pages -f build_type=workflow`, then run the "Deploy to GitHub Pages" workflow.
