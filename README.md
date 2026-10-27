# deck-template

GitHub template for private presentation repos. Choose **reveal.js** or **impress.js** per repo.
Both flavors share one interface: `npm run dev`, `npm run build` -> `dist/`.

## One-time setup

1. Install: Docker, VS Code + "Dev Containers" extension, git, Node 18+ (or rely on Docker), GitHub CLI (`gh auth login`).
2. Push this folder to a private GitHub repo and mark it as a template:
   ```bash
   git init -b main && git add -A && git commit -m "chore: initial template"
   gh repo create deck-template --private --source=. --push
   gh repo edit --template
   ```
   Do not run `scripts/protect.sh` on the template itself.
3. Add to your shell profile (adjust the path and owner):
   ```bash
   export DECK_TEMPLATE=<your-github-user>/deck-template
   alias new-deck='~/src/deck-template/scripts/new-deck.sh'
   ```

## Every new deck

```bash
new-deck quarterly-review reveal     # or: impress
DECK_NODE_CHANNEL=lts new-deck ...   # pin the LTS line instead of the newest release
```
The wrapper creates the private repo, pins the newest Node and npm at that moment (`.nvmrc`, Dockerfile,
`.deck.json`), commits `chore: initialize ...`, pushes, and then protects `main` (`scripts/protect.sh`).
Then in VS Code: **Reopen in Container**, `npm run dev`, open http://localhost:5173.

## Created the repo in the web UI instead?

Actions tab -> **Initialize deck** -> Run workflow (framework + Node channel), then `git pull`, then
run `scripts/protect.sh` once. Initialize first: `main` rejects direct pushes after protection.

## Branch protection and commit convention

`scripts/protect.sh` applies `.github/rulesets/main.json` to the default branch: PR required (no approvals,
so you can merge your own), `build` check required, linear history, no force-push, no deletion, and a
commit-message regex for Conventional Commits. It also restricts merging to squash and enables auto-merge
and branch auto-delete. The local commit-msg hook (husky + commitlint) gives immediate feedback.
Rulesets on private repos need GitHub Pro, Team or Enterprise Cloud.

## Issue and PR templates

- Issues: `.github/ISSUE_TEMPLATE/` (presentation brief, content task, build/render problem, review feedback,
  maintenance). Blank issues are disabled in `config.yml`.
- Pull requests: `.github/PULL_REQUEST_TEMPLATE.md` is the default; `content.md`, `fix.md` and `chore.md` live in
  `.github/PULL_REQUEST_TEMPLATE/` and are selected with `gh pr create --template <file>` or `?template=<file>` in the URL.
- Squash merges use the PR title only (`protect.sh` sets the commit body to blank), so template text never lands on `main`.

## Notes

- Node/npm are resolved when the deck is created and then pinned. Re-pin with `node scripts/init.mjs --refresh-node`.
- impress.js is vendored (`public/vendor/impress.js`, version in `IMPRESS_VERSION`); a weekly workflow opens a PR
  for new releases (needs "Allow GitHub Actions to create and approve pull requests").
- GitHub Pages is opt-in and **public** unless you are on Enterprise Cloud. See the generated deck README.
- `.template/` and `scripts/init.mjs` only matter until a repo is initialized.
