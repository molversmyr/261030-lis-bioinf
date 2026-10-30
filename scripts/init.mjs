#!/usr/bin/env node
// Usage:
//   node scripts/init.mjs <reveal|impress>   apply a framework flavor and pin Node/npm
//   node scripts/init.mjs --refresh-node      re-resolve and re-pin Node/npm of an initialized deck
// Env: DECK_NODE_CHANNEL=latest|lts (default: latest)
//      DECK_NODE_INDEX_URL / DECK_NPM_LATEST_URL (override sources, for testing)
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FLAVORS = ['reveal', 'impress'];
const CHANNELS = ['latest', 'lts'];
const NODE_INDEX_URL = process.env.DECK_NODE_INDEX_URL || 'https://nodejs.org/dist/index.json';
const NPM_LATEST_URL = process.env.DECK_NPM_LATEST_URL || 'https://registry.npmjs.org/npm/latest';

const strip = (v) => v.replace(/^v/, '');
const cmp = (a, b) => {
  const [x, y] = [a, b].map((v) => strip(v).split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

// nodejs.org/dist/index.json is date-sorted across all release lines, so index[0] can be a
// patch of an older line. Take the highest semver instead.
const isStable = (e) => /^v?\d+\.\d+\.\d+$/.test(e.version);

export function pickNode(index, channel) {
  const pool = (channel === 'lts' ? index.filter((e) => e.lts) : index).filter(isStable);
  if (!pool.length) throw new Error(`no ${channel} Node release found`);
  return pool.map((e) => strip(e.version)).reduce((a, b) => (cmp(a, b) >= 0 ? a : b));
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

const DOCKER_TAGS_URL = process.env.DECK_DOCKER_TAGS_URL || 'https://hub.docker.com/v2/repositories/library/node/tags';

// true = tag exists, false = definitely missing, null = could not check (offline/proxy)
async function imageTagExists(tag) {
  try {
    const res = await fetch(`${DOCKER_TAGS_URL}/${tag}`);
    if (res.status === 404) return false;
    return res.ok ? true : null;
  } catch {
    return null;
  }
}

// Stable releases of the channel, newest first.
export function candidates(index, channel) {
  const pool = (channel === 'lts' ? index.filter((e) => e.lts) : index).filter(isStable);
  return pool.map((e) => strip(e.version)).sort((a, b) => cmp(b, a));
}

// New releases can lag on Docker Hub, and a brand-new major may have no official images at all:
// walk down from the newest release until the image tag exists.
async function pickImageVersion(list) {
  for (const version of list.slice(0, 15)) {
    if ((await imageTagExists(`${version}-bookworm`)) === false) {
      console.warn(`node:${version}-bookworm is not on Docker Hub (yet); trying an older release.`);
      continue;
    }
    return version;
  }
  throw new Error('no recent Node release has an official Docker image');
}

// Resolves Node + npm, rewrites .nvmrc and the Dockerfile. Returns what to record in .deck.json.
async function pinToolchain(root, channel) {
  try {
    const node = await pickImageVersion(candidates(await getJson(NODE_INDEX_URL), channel));
    const npm = (await getJson(NPM_LATEST_URL)).version;

    writeFileSync(join(root, '.nvmrc'), `${node}\n`);
    const dockerfile = join(root, '.devcontainer', 'Dockerfile');
    const text = readFileSync(dockerfile, 'utf8')
      .replace(/^FROM node:.*$/m, `FROM node:${node}-bookworm`)
      .replace(/^RUN npm install -g npm@.*$/m, `RUN npm install -g npm@${npm}`);
    writeFileSync(dockerfile, text);
    return { node, npm };
  } catch (err) {
    console.warn(
      `WARNING: could not resolve Node/npm versions (${err.message}). Keeping floating defaults (Node LTS, npm@latest).\n` +
        'Re-run "node scripts/init.mjs --refresh-node" when online.',
    );
    return { node: 'lts/*', npm: 'latest' };
  }
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

async function main() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const arg = process.argv[2];
  const channel = process.env.DECK_NODE_CHANNEL || 'latest';
  if (!CHANNELS.includes(channel)) {
    console.error(`DECK_NODE_CHANNEL must be one of: ${CHANNELS.join(', ')}`);
    process.exit(1);
  }
  const deckFile = join(root, '.deck.json');

  if (arg === '--refresh-node') {
    if (!existsSync(deckFile)) {
      console.error('Not initialized yet (.deck.json missing).');
      process.exit(1);
    }
    const deck = readJson(deckFile);
    Object.assign(deck, await pinToolchain(root, channel), { channel });
    writeJson(deckFile, deck);
    console.log(`Pinned Node ${deck.node} and npm ${deck.npm}. Rebuild the devcontainer to apply.`);
    return;
  }

  const framework = arg;
  if (!FLAVORS.includes(framework)) {
    console.error(`Usage: node scripts/init.mjs <${FLAVORS.join('|')}> | --refresh-node`);
    process.exit(1);
  }
  if (existsSync(deckFile)) {
    console.error('Already initialized (.deck.json exists). Nothing changed.');
    process.exit(1);
  }
  const flavorDir = join(root, '.template', framework);
  if (!existsSync(flavorDir)) {
    console.error(`Missing ${flavorDir}. Is this the template repo itself, or already initialized?`);
    process.exit(1);
  }

  // 1. Copy the chosen flavor to the repo root, then drop all flavors.
  cpSync(flavorDir, root, { recursive: true });
  rmSync(join(root, '.template'), { recursive: true, force: true });

  // 2. Name the package after the repo folder (package.json and lockfile).
  const name =
    basename(root).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-._]+|[-._]+$/g, '') || 'deck';
  const pkgPath = join(root, 'package.json');
  const pkg = readJson(pkgPath);
  pkg.name = name;
  writeJson(pkgPath, pkg);

  const lockPath = join(root, 'package-lock.json');
  if (existsSync(lockPath)) {
    const lock = readJson(lockPath);
    lock.name = name;
    if (lock.packages?.['']) lock.packages[''].name = name;
    writeJson(lockPath, lock);
  }

  // 3. Pin Node/npm, record the choice, replace the template README with a deck README.
  const { node, npm } = await pinToolchain(root, channel);
  writeJson(deckFile, { framework, node, npm, channel, initialized: new Date().toISOString() });

  const where = framework === 'reveal' ? 'index.html and src/main.js' : 'index.html (slides are .step elements)';
  writeFileSync(
    join(root, 'README.md'),
    `# ${name}

Framework: **${framework === 'reveal' ? 'reveal.js' : 'impress.js'}** | Node ${node} | npm ${npm} (pinned in \`.deck.json\`)

## Work on it

1. Open the folder in VS Code and choose **Reopen in Container**.
2. \`npm run dev\` and open http://localhost:5173
3. Edit ${where}; styles are in \`src/theme.css\`.

## Commits and branch protection

\`main\` is meant to be protected (GitHub enforces this only on public repos on the Free plan: run \`scripts/protect.sh\` once the repo is public): no direct pushes, no force-push, squash merges only, the \`build\` check must pass,
and every commit message must follow Conventional Commits (\`feat: ...\`, \`fix: ...\`, \`docs: ...\`).
A local hook (commitlint) checks each commit; the \`pr-title\` check enforces the format on the PR title, which becomes the commit on \`main\`.

\`\`\`bash
git switch -c feat/roadmap-slide
git commit -m "feat: add roadmap slide"
git push -u origin HEAD
gh pr create --title "feat: add roadmap slide" --template content.md   # title = commit on main
# templates: content.md, fix.md, chore.md (or omit --template for the default)
gh pr merge --squash --auto
\`\`\`

Commit from inside the devcontainer (the hook needs the installed dependencies).

## Build

\`npm run build\` writes a static, relocatable site to \`dist/\`.
\`npm run build:pdf\` also writes \`dist/${name}.pdf\` (uses the Chromium installed in the devcontainer).
CI uploads it as the \`deck\` artifact on every push (Actions tab).

## Re-pin Node/npm

\`node scripts/init.mjs --refresh-node\` (set \`DECK_NODE_CHANNEL=lts\` for LTS), then rebuild the container.

## Publish (optional, read first)

On every plan except GitHub Enterprise Cloud, a GitHub Pages site is public even if this repository is private.
Do not enable Pages for confidential decks. To enable it deliberately:
\`gh api -X POST repos/<owner>/${name}/pages -f build_type=workflow\`, then run the "Deploy to GitHub Pages" workflow.
`,
  );

  console.log(`Initialized ${framework} deck "${name}" (Node ${node}, npm ${npm}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
