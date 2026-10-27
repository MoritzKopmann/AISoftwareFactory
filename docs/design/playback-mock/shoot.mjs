// Mock harness only: node shoot.mjs  (expects serve.mjs running on 5310)
// Uses the globally installed Playwright; the repo does not depend on it.
/* global document, window, getComputedStyle */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
const shots = [
  { name: 'shot-1440.png', width: 1440, q: 'ac=AC1&theme=light' },
  { name: 'shot-1920.png', width: 1920, q: 'ac=AC1&theme=light' },
  { name: 'shot-1440-ac3-split.png', width: 1440, q: 'ac=AC3&theme=light' },
  { name: 'shot-1920-ac3-split.png', width: 1920, q: 'ac=AC3&theme=light' },
  { name: 'shot-1440-all.png', width: 1440, q: 'ac=All&theme=light' },
  { name: 'shot-1920-all.png', width: 1920, q: 'ac=All&theme=light' },
  { name: 'shot-1440-ac3-dark.png', width: 1440, q: 'ac=AC3&theme=dark' },
  { name: 'shot-1920-all-dark.png', width: 1920, q: 'ac=All&theme=dark' },
];

(async () => {
  const browser = await chromium.launch();
  for (const shot of shots.filter((s) => !process.argv[2] || s.name.includes(process.argv[2]))) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: 1000 } });
    page.on(
      'console',
      (m) =>
        m.type() !== 'log' &&
        !m.text().includes('404') &&
        console.log(`  [${m.type()}] ${m.text()}`),
    );
    page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`http://localhost:5310/?${shot.q}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const check = await page.evaluate(() => {
      const out = window.__pbCheck();
      out.scrollW = document.documentElement.scrollWidth;
      out.innerW = window.innerWidth;
      const fig = document.querySelector('aisf-figure');
      out.figScroll = fig.scrollWidth - fig.clientWidth;
      let small = [];
      for (const node of document.querySelectorAll(
        '.pb-map *, .pb-route *, .pb-criterion *, .pbq *',
      )) {
        if (
          !node.childNodes.length ||
          ![...node.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())
        )
          continue;
        const size = parseFloat(getComputedStyle(node).fontSize);
        if (size < 12) small.push(`${node.className}:${size}`);
      }
      out.small = [...new Set(small)].slice(0, 10);
      out.cols = getComputedStyle(document.getElementById('pb-map')).gridTemplateColumns;
      return out;
    });
    console.log(shot.name, JSON.stringify(check));
    await page.screenshot({ path: path.join(dir, shot.name), fullPage: true });
    await page.close();
  }
  await browser.close();
})();
