// Captures of every tab on two phone sizes, from the demo airport (?demo=1).
// Used by CI on each PR (artifact « captures ») and for the Play Store listing.
// Usage: npm run build && npx vite preview --port 4173 & node scripts/screens.mjs [url] [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
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
  await page.click('#modal', { position: { x: 5, y: 5 } });
  await page.click('#hud .lvl');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${size.name}-profil.png` });
  await page.close();
}

// Night on the local clock, and the tablet / landscape layout.
const extra = [
  { name: 'nuit-412x915', viewport: { width: 412, height: 915 }, time: '2026-10-27T23:00:00' },
  { name: 'tablette-1280x800', viewport: { width: 1280, height: 800 }, tab: 'vols' },
];
for (const shot of extra) {
  const page = await browser.newPage({ viewport: shot.viewport, deviceScaleFactor: 1.5 });
  page.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
  if (shot.time) await page.clock.setFixedTime(new Date(shot.time));
  await page.addInitScript(() => localStorage.setItem('idleport.welcome', '1'));
  await page.goto(`${url}?demo=1`);
  await page.waitForTimeout(1500);
  if (shot.tab) {
    await page.click(`#tabs [data-tab="${shot.tab}"]`);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${out}/${shot.name}.png` });
  await page.close();
}
// English version: every tab and sheet, and the French texts still without an English entry.
{
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(`en: ${e.message}`));
  await page.addInitScript(() => {
    localStorage.setItem('idleport.welcome', '1');
    localStorage.setItem('idleport.settings', JSON.stringify({ lang: 'en' }));
  });
  await page.goto(`${url}?demo=1`);
  await page.waitForTimeout(1500);
  for (const tab of TABS) {
    const btn = page.locator(`#tabs [data-tab="${tab}"]`);
    if (!(await btn.count())) continue;
    await btn.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/en-412x915-${tab}.png` });
  }
  await page.click('.gear');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/en-412x915-reglages.png` });
  const left = await page.evaluate(() => [...(window.idleportMissing ?? [])].sort());
  writeFileSync(`${out}/missing-en.txt`, left.join('\n') + '\n');
  console.log(`${left.length} textes sans anglais (${out}/missing-en.txt)`);
  await page.close();
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Captures dans ${out}/`);
