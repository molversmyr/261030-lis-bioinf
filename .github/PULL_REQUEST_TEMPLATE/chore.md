<!-- Title format: "chore: ...", "build: ..." (dependencies, Node/npm), or "ci: ..." (workflows) -->

## What and why
<!-- Updated dependencies / pins / config and the reason. -->

## Versions
<!-- From -> to, e.g. vite 8.3.4 -> 8.4.0, Node 26.12.0 -> 26.13.0. -->

## Checklist
- [ ] `npm ci && npm run build` succeeds
- [ ] Release notes checked for breaking changes
- [ ] Devcontainer rebuilt and dev server starts (if the Dockerfile or Node pin changed)
- [ ] Lockfile changes are limited to what this PR intends
