#!/usr/bin/env node
// Export a built reveal.js or impress.js deck to dist/<package name>.pdf.
// Default: one screen-rendered PNG per slide, embedded in a PDF.
// PDF_MODE=native retains reveal.js' selectable-text print export.
// Env: CHROMIUM_PATH, CHROMIUM_ARGS (space-separated flags), PDF_MODE,
//      PDF_WIDTH=1920, PDF_HEIGHT=1080, PDF_PAUSE_MS=300.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const dist = resolve(root, 'dist');
const readJson = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
const timeout = 30_000;

function integerEnv(name, fallback, minimum) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}.`);
  }
  return value;
}

const width = integerEnv('PDF_WIDTH', 1920, 1);
const height = integerEnv('PDF_HEIGHT', 1080, 1);
const pause = integerEnv('PDF_PAUSE_MS', 300, 0);
const mode = process.env.PDF_MODE || 'raster';
const { framework } = readJson('.deck.json');
if (!['reveal', 'impress'].includes(framework)) {
  throw new Error(`Unsupported framework: ${framework}`);
}
if (!['raster', 'native'].includes(mode) || (mode === 'native' && framework !== 'reveal')) {
  throw new Error('PDF_MODE must be raster, or native for reveal.js only.');
}
if (!existsSync(join(dist, 'index.html'))) {
  throw new Error('dist/index.html not found. Run "npm run build:pdf".');
}
const name = readJson('package.json').name.replace(/^@/, '').replaceAll('/', '-');
const out = join(dist, `${name}.pdf`);
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
if (!existsSync(executablePath)) {
  throw new Error(`Chromium not found at ${executablePath}. Set CHROMIUM_PATH or use the devcontainer.`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const server = createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(dist, `.${pathname}`);
    if (file !== dist && !file.startsWith(dist + sep)) return void res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) || !statSync(file).isFile()) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(400).end();
  }
});

// A slide may start lazy image/background/font requests only after navigation.
// Custom charts, iframes and application-specific animation need the hook below.
async function settle(page, index) {
  await page.evaluate(async ({ framework, index, timeout }) => {
    let timer;
    try {
      await Promise.race([
        Promise.resolve().then(() => window.preparePdfSlide?.({ framework, index })),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('preparePdfSlide timed out')), timeout);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    document.querySelectorAll('video, audio').forEach((media) => media.pause());
    // Trigger native lazy images when they are part of the visible slide.
    for (const img of document.images) {
      const r = img.getBoundingClientRect();
      if (r.width && r.height && r.bottom > 0 && r.right > 0 &&
          r.top < innerHeight && r.left < innerWidth) img.loading = 'eager';
    }
  }, { framework, index, timeout });
  await page.waitForNetworkIdle({ idleTime: 300, timeout });
  await page.evaluate(async (timeout) => {
    let timer;
    try {
      await Promise.race([
        (async () => {
          await document.fonts.ready;
          await Promise.all(Array.from(document.images).filter((img) => {
            const r = img.getBoundingClientRect();
            return (img.currentSrc || img.getAttribute('src')) && r.width && r.height &&
              r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
          }).map(async (img) => {
            await img.decode();
            if (!img.naturalWidth) throw new Error(`Image failed to decode: ${img.currentSrc}`);
          }));
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Slide assets timed out')), timeout);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }, timeout);
  if (pause) await delay(pause);
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

let browser;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', ...(process.env.CHROMIUM_ARGS?.split(' ').filter(Boolean) ?? [])],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(timeout);
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.emulateMediaType(mode === 'native' ? 'print' : 'screen');
  const errors = new Set();
  page.on('pageerror', (error) => errors.add(error.message));
  page.on('requestfailed', (req) => {
    if (req.failure()?.errorText !== 'net::ERR_ABORTED') {
      errors.add(`${req.failure()?.errorText}: ${req.url()}`);
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && new URL(res.url()).pathname !== '/favicon.ico') {
      errors.add(`HTTP ${res.status()}: ${res.url()}`);
    }
  });
  const assertHealthy = () => {
    if (errors.size) throw new Error(`Deck errors:\n${Array.from(errors).join('\n')}`);
  };

  await page.goto(`${base}/index.html?${mode === 'native' ? 'print-pdf' : 'export-pdf'}`, {
    waitUntil: 'networkidle0', timeout,
  });
  if (mode === 'native') {
    // __pdfReady is set by the proposed src/main.js listener, before initialize().
    await page.waitForFunction(() => window.__pdfReady === true);
    await settle(page, null);
    // Decode all printed images, including pages outside the viewport.
    await page.evaluate(() => Promise.all(Array.from(document.images)
      .filter((img) => img.currentSrc || img.getAttribute('src'))
      .map((img) => img.decode())));
    assertHealthy();
    await page.pdf({ path: out, printBackground: true, preferCSSPageSize: true });
  } else {
    let slides;
    if (framework === 'reveal') {
      await page.waitForFunction(() => window.Reveal?.isReady?.());
      await page.addStyleTag({ content: `
        .reveal .slides section, .reveal .slide-background, .reveal .fragment {
          transition: none !important;
        }
      ` });
      slides = await page.evaluate(() => {
        const deck = window.Reveal;
        deck.configure({
          controls: false, progress: false, autoSlide: 0,
          transition: 'none', backgroundTransition: 'none', autoAnimate: false,
        });
        deck.toggleAutoSlide(false);
        // Include uncounted appendix slides; exclude vertical stack containers.
        return deck.getHorizontalSlides().flatMap((slide) =>
          slide.classList.contains('stack')
            ? Array.from(slide.children).filter((child) => child.tagName === 'SECTION')
            : [slide]
        ).map((slide) => {
          const { h, v } = deck.getIndices(slide);
          return { h, v: v ?? 0 };
        });
      });
    } else {
      await page.waitForSelector('body.impress-enabled');
      slides = await page.$$eval('#impress .step', (els) => els.map((el) => el.id));
      await page.evaluate(() => {
        const step = document.querySelector('#impress .step.active');
        step.dispatchEvent(new CustomEvent('impress:autoplay:pause', { bubbles: true }));
      });
    }
    if (!slides.length) throw new Error('No slides found.');
    const shots = [];
    for (const [index, slide] of slides.entries()) {
      if (framework === 'reveal') {
        await page.evaluate(({ h, v }) => {
          const deck = window.Reveal;
          const target = deck.getSlide(h, v);
          deck.syncFragments(target);
          const lastFragment = Math.max(-1, ...Array.from(
            target.querySelectorAll('.fragment:not(.disabled)'),
            (el) => Number(el.dataset.fragmentIndex),
          ));
          deck.slide(h, v, lastFragment);
        }, slide);
      } else {
        await page.evaluate((id) => new Promise((resolve, reject) => {
          const step = document.getElementById(id);
          const done = () => {
            clearTimeout(timer);
            step.removeEventListener('impress:steprefresh', done);
            resolve();
          };
          const timer = setTimeout(() => {
            step.removeEventListener('impress:steprefresh', done);
            reject(new Error(`impress.js did not enter ${id}`));
          }, 30_000);
          // steprefresh also fires when reselecting the already-active first step.
          step.addEventListener('impress:steprefresh', done);
          if (window.impress().goto(id, 0) === false) {
            clearTimeout(timer);
            step.removeEventListener('impress:steprefresh', done);
            reject(new Error(`impress.js refused navigation to ${id}`));
          }
        }), slide);
      }
      await settle(page, index);
      assertHealthy();
      // Ask Puppeteer for base64 explicitly: screenshot() otherwise returns Uint8Array.
      shots.push(await page.screenshot({ type: 'png', encoding: 'base64', omitBackground: false }));
      console.log(`Captured ${index + 1}/${slides.length}`);
    }
    const doc = await browser.newPage();
    await doc.setContent(`<!doctype html><html><head><style>
      @page { size: ${width}px ${height}px; margin: 0; }
      html, body { margin: 0; padding: 0; }
      section { width: ${width}px; height: ${height}px; break-after: page; overflow: hidden; }
      section:last-child { break-after: auto; }
      img { display: block; width: 100%; height: 100%; }
    </style></head><body>${shots.map((shot) =>
      `<section><img src="data:image/png;base64,${shot}"></section>`).join('')}</body></html>`,
    { waitUntil: 'load' });
    await doc.evaluate(async () => {
      await Promise.all(Array.from(document.images, async (img) => {
        await img.decode();
        if (!img.naturalWidth) throw new Error('A screenshot failed to decode.');
      }));
    });
    await doc.pdf({ path: out, printBackground: true, preferCSSPageSize: true });
  }
  console.log(`Wrote ${out} (${mode})`);
} finally {
  try {
    await browser?.close();
  } finally {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
}
