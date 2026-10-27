// Captures of every tab on two phone sizes, from the demo airport (?demo=1).
// Used by CI on each PR (artifact « captures ») and for the Play Store listing.
// Usage: npm run build && npx vite preview --port 4173 & node scripts/screens.mjs [url] [outDir]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'captures';
mkdirSync(out, { recursive: true });

const SIZES = [
  { name: '360x800', width: 360, height: 800 },
  { name: '412x915', width: 412, height: 915 },
];
const TABS = ['tour', 'vols', 'equipe', 'objectifs', 'amis'];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });
const errors = [];
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(`${size.name}: ${e.message}`));
  await page.addInitScript(() => localStorage.setItem('idleport.welcome', '1'));
  await page.goto(`${url}?demo=1`);
  await page.waitForTimeout(1500);
  for (const tab of TABS) {
    const btn = page.locator(`#tabs [data-tab="${tab}"]`);
    if (!(await btn.count())) continue;
    await btn.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${size.name}-${tab}.png` });
  }
  await page.click('.gear');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${size.name}-reglages.png` });
  await page.close();
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Captures dans ${out}/`);
