#!/usr/bin/env node
// Exports the built deck (dist/) to dist/<package name>.pdf with headless Chromium.
//   reveal : reveal.js' native print layout (vector PDF, selectable text)
//   impress: one screenshot per step (image-based PDF; impress has no print layout)
// Env: CHROMIUM_PATH (default /usr/bin/chromium), CHROMIUM_ARGS (extra flags, space separated)
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const dist = join(root, 'dist');
const readJson = (f) => JSON.parse(readFileSync(join(root, f), 'utf8'));

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ not found. Run "npm run build" first, or use "npm run build:pdf".');
  process.exit(1);
}
const { framework } = readJson('.deck.json');
const out = join(dist, `${readJson('package.json').name}.pdf`);
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
if (!existsSync(executablePath)) {
  console.error(`Chromium not found at ${executablePath}. Rebuild the devcontainer, or set CHROMIUM_PATH.`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json',
};
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = join(dist, normalize(pathname));
  if (!file.startsWith(dist)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', ...(process.env.CHROMIUM_ARGS?.split(' ').filter(Boolean) ?? [])],
});

try {
  const page = await browser.newPage();
  if (framework === 'reveal') {
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(`${base}/index.html?print-pdf`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.pdf-page');
    await page.pdf({ path: out, printBackground: true, preferCSSPageSize: true });
  } else {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('body.impress-enabled');
    const steps = await page.$$eval('#impress .step', (els) => els.length);
    const shots = [];
    for (let i = 0; i < steps; i++) {
      await new Promise((r) => setTimeout(r, 1300)); // default impress transition is 1000 ms
      shots.push((await page.screenshot({ type: 'png' })).toString('base64'));
      await page.evaluate(() => window.impress().next());
    }
    const doc = await browser.newPage();
    await doc.setContent(
      '<style>@page{size:1920px 1080px;margin:0}html,body{margin:0}' +
        'img{display:block;width:1920px;height:1080px;page-break-after:always}img:last-child{page-break-after:auto}</style>' +
        shots.map((s) => `<img src="data:image/png;base64,${s}">`).join(''),
    );
    await doc.pdf({ path: out, printBackground: true, preferCSSPageSize: true });
  }
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
  server.close();
}
