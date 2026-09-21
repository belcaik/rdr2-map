import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = new URL('../../artifacts/real/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
const start = performance.now();
await page.goto('http://127.0.0.1:5178');
await page.getByPlaceholder('Search waypoints').waitFor();
const initialMs = performance.now() - start;
async function select(id) {
  const point = await (await page.request.get(`http://127.0.0.1:3904/api/markers/${id}`)).json();
  await page.getByPlaceholder('Search waypoints').fill(point.name);
  const matches = page.getByRole('button', { name: point.name, exact: true });
  const count = await matches.count();
  let target = matches.first();
  if (count > 1) target = matches.filter({ hasText: new RegExp(`· ${id}$`) });
  await target.click();
  await page.getByRole('heading', { name: point.name, exact: true }).waitFor();
  return point;
}
for (const id of [743, 56, 91]) {
  const point = await select(id);
  if (point.images.length) await page.locator('aside[aria-label="Waypoint details"] .gallery figure img').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}detail-${id}-desktop.png` });
  if (id === 56) {
    await page.getByRole('button', { name: 'Next photograph' }).click();
    await page.getByRole('button', { name: 'Enlarge photograph' }).click();
    await page.screenshot({ path: `${output}bone-gallery.png` });
    await page.keyboard.press('Escape');
  }
}
const controls = [];
for (const id of [158, 681, 682]) {
  const point = await select(id);
  await page.getByRole('button', { name: 'Close waypoint details' }).click();
  await page.getByPlaceholder('Search waypoints').press('Escape');
  // Reset to min zoom, then exercise two independently observed local zooms.
  for (let i = 0; i < 5; i++) { await page.locator('.leaflet-control-zoom-out').click({ force: true }); await page.waitForTimeout(350); }
  await page.locator('.leaflet-control-zoom-in').click();
  await page.waitForTimeout(350);
  await select(id);
  await page.getByRole('button', { name: 'Close waypoint details' }).click();
  await page.getByPlaceholder('Search waypoints').press('Escape');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}control-${id}-z3.png` });
  await page.locator('.leaflet-control-zoom-in').click();
  await page.waitForTimeout(350);
  await page.locator('.leaflet-control-zoom-in').click();
  await page.waitForTimeout(350);
  await select(id);
  await page.getByRole('button', { name: 'Close waypoint details' }).click();
  await page.getByPlaceholder('Search waypoints').press('Escape');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}control-${id}-z5.png` });
  const tileZooms = await page.locator('img.leaflet-tile').evaluateAll(images => [...new Set(images.map(image => Number(image.getAttribute('src').match(/\/tiles\/(\d+)\//)[1])))]);
  if (!tileZooms.includes(5)) throw new Error(`Zoom 5 tiles absent for control ${id}: ${tileZooms}`);
  controls.push({ id, name: point.name, coordinates: [point.coord_x, point.coord_y], tileZooms });
}
await page.setViewportSize({ width: 390, height: 844 });
await select(743);
await page.waitForTimeout(500);
await page.screenshot({ path: `${output}blazing-mobile.png` });
const stats = await page.evaluate(() => ({ domNodes: document.querySelectorAll('*').length, canvases: document.querySelectorAll('.waypoint-canvas').length, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }));
const markers = await (await page.request.get('http://127.0.0.1:3904/api/markers')).json();
await page.getByRole('button', { name: 'Close waypoint details' }).click();
const filterStart = performance.now();
await page.getByRole('button', { name: 'Categories', exact: true }).click();
await page.getByRole('button', { name: 'Hide All', exact: true }).click();
await page.getByRole('button', { name: 'Show All', exact: true }).click();
const filterRoundtripMs = performance.now() - filterStart;
const report = { points: markers.length, initialMs, filterRoundtripMs, ...stats, controls, errors };
await writeFile(`${output}measurements.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await browser.close();
