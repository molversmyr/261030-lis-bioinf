# 261030-lis-bioinf

Framework: **reveal.js** | Node 26.12.1 | npm 12.2.1 (pinned in `.deck.json`)

## Work on it

1. Open the folder in VS Code and choose **Reopen in Container**.
2. `npm run dev` and open http://localhost:5173
3. Edit index.html and src/main.js; styles are in `src/theme.css`.

## Slides and translations

Slide content lives in `index.html`. Text marked with `data-i18n` is translated by the Reveal.js Internation plugin using `locales/en.json` and `locales/no.json`; Norwegian (`no`) is the default, with English available in the language selector. Keep each slide's translation keys aligned with its section ID in both JSON files. Navigation labels are in each file's `menubar` object.

Internation 1.1.0 declares a Reveal.js 4 peer range; `.npmrc` allows installation with this deck's Reveal.js 6 dependency. The JSON catalogs are imported into the Vite bundle for reliable loading.

## Test a Pages build

Run `npm run build` followed by `npm run preview` to test the production build locally at http://localhost:4173. The relative asset base also supports GitHub Pages project URLs.

The **Deploy to GitHub Pages** workflow can be run manually from a branch using **Actions → Deploy to GitHub Pages → Run workflow**. This publishes that branch to the repository's configured Pages site, replacing its current deployment; it is not an isolated preview. GitHub Pages is public on most plans, even when the repository is private. Use the local preview when you do not want to publish the content.

## Commits and branch protection

`main` is protected: no direct pushes, no force-push, squash merges only, the `build` check must pass,
and every commit message must follow Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`).
A local hook (commitlint) checks each commit; the `pr-title` check enforces the format on the PR title, which becomes the commit on `main`.

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
