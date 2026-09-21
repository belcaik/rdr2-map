import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const api = 'http://127.0.0.1:3903/api';
test.beforeEach(async ({ context, request }) => {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  for (let id = 1001; id <= 1008; id++) await request.post(`${api}/progress/${id}`, { data: { found: false } });
});

async function select(page: import('@playwright/test').Page, title: string) {
  await page.getByPlaceholder('Search waypoints').fill(title);
  await page.getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('local gallery, safe description and durable reimport preserve found_at', async ({ page, request }) => {
  const errors: string[] = [];
  const remoteImages: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.resourceType() === 'image' && !['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) remoteImages.push(request.url()); });
  await page.goto('/');
  await select(page, 'Two photographs');
  const detail = page.getByRole('complementary', { name: 'Waypoint details' });
  await expect(detail.locator('strong')).toContainText('Reference notes');
  await expect(detail.locator('img[src$="/api/assets/photo-one"]').first()).toBeVisible();
  await detail.getByRole('button', { name: 'Next photograph' }).click();
  await expect(detail.locator('img[src$="/api/assets/photo-two"]').first()).toBeVisible();
  await detail.getByRole('button', { name: 'Enlarge photograph' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', /\/api\/assets\/photo-one$/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await detail.getByRole('button', { name: 'Mark as found', exact: true }).click();
  await expect(detail.getByRole('button', { name: 'Mark as not found', exact: true })).toBeVisible();
  const before = await (await request.get(`${api}/progress`)).json();
  const runtime = JSON.parse(readFileSync(new URL('./.runtime.json', import.meta.url), 'utf8'));
  const original = JSON.parse(readFileSync(path.join(runtime.root, 'dataset.json'), 'utf8'));
  const partial = { ...original, runId: 'partial-e2e', waypoints: [original.waypoints[0]], categories: [original.categories[0]], assets: original.assets.filter((a: { id: string }) => ['icon-card', 'photo-one', 'photo-two'].includes(a.id)), coverage: { ...original.coverage, discovered: 1 } };
  const partialFile = path.join(runtime.root, 'partial.json');
  writeFileSync(partialFile, JSON.stringify(partial));
  for (const file of [path.join(runtime.root, 'dataset.json'), partialFile]) {
    const result = spawnSync(path.resolve('../backend/node_modules/.bin/tsx'), [path.resolve('../backend/src/db/import.ts'), file, '--db', runtime.db, '--data-root', runtime.root], { encoding: 'utf8' });
    expect(result.status, result.stderr + result.stdout).toBe(0);
  }
  expect(await (await request.get(`${api}/progress`)).json()).toEqual(before);
  expect(await (await request.get(`${api}/markers`)).json()).toHaveLength(8);
  expect(await (await request.get(`${api}/markers/categories`)).json()).toHaveLength(3);
  await page.reload();
  await select(page, 'Two photographs');
  await expect(detail.getByRole('button', { name: 'Mark as not found', exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Next photograph' }).click();
  await select(page, 'One photograph');
  await expect(detail.locator('img[src$="/api/assets/photo-one"]').first()).toBeVisible();
  await expect(detail.locator('img[src$="/api/assets/photo-two"]')).toHaveCount(0);
  await select(page, 'No photographs');
  await expect(detail.locator('img[src*="/api/assets/photo-"]')).toHaveCount(0);
  await select(page, 'HTML description');
  await expect(detail.locator('strong')).toHaveText('Safe formatting');
  await expect(detail.locator('script')).toHaveCount(0);
  expect(await page.evaluate(() => 'injected' in window)).toBe(false);
  expect(remoteImages).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/synthetic-desktop.png' });
});

test('distinct discovery and download states; missing local file', async ({ page }) => {
  await page.goto('/');
  const detail = page.getByRole('complementary', { name: 'Waypoint details' });
  for (const [title, message] of [['No photographs', /no photographs/i], ['Not inspected', /not.*inspect|yet.*inspect/i], ['Discovery failed', /could not.*inspect|inspection.*fail|discovery.*fail/i], ['Download pending', /pending/i], ['Download failed', /download.*fail|could not.*download/i]]) {
    await select(page, title as string);
    await expect(detail).toContainText(message as RegExp);
  }
  await page.route('**/api/assets/photo-one', route => route.fulfill({ status: 404, body: '' }));
  await select(page, 'One photograph');
  await expect(detail).toContainText(/local.*unavailable|local.*missing|file.*unavailable/i);
});

test('mobile keyboard gallery and layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await select(page, 'Two photographs');
  await page.getByRole('button', { name: 'Enlarge photograph' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', /\/api\/assets\/photo-two$/);
  await page.getByRole('button', { name: 'Close gallery' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/synthetic-mobile.png' });
});

test('category symbols are drawn on canvas and retained when found; filters and focus work', async ({ page }) => {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    const recorded: { src: string; alpha: number }[] = [];
    Object.defineProperty(window, '__symbolDraws', { value: recorded });
    CanvasRenderingContext2D.prototype.drawImage = function (...args: Parameters<typeof original>) {
      const image = args[0];
      if (image instanceof HTMLImageElement) recorded.push({ src: image.src, alpha: this.globalAlpha });
      if (recorded.length > 2000) recorded.splice(0, 1000);
      return Reflect.apply(original, this, args);
    };
  });
  await page.goto('/');
  const readDraws = () => page.evaluate(() => Reflect.get(window, '__symbolDraws') as { src: string; alpha: number }[]);
  await expect.poll(async () => new Set((await readDraws()).map(row => row.src)).size).toBe(3);
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  const category = page.getByRole('complementary', { name: 'Categories' });
  const cardIcon = await category.getByRole('img', { name: 'Card symbol' }).getAttribute('src');
  expect((await readDraws()).some(row => row.src === cardIcon)).toBe(true);
  await category.getByRole('button', { name: 'Hide All' }).click();
  await category.getByRole('button', { name: 'Close categories' }).click();
  await page.getByPlaceholder('Search waypoints').fill('Two photographs');
  await expect(page.getByText('No matching visible waypoints.')).toBeVisible();
  await page.getByRole('button', { name: 'Close results' }).click();
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await category.getByRole('button', { name: 'Show All' }).click();
  await category.getByRole('button', { name: 'Close categories' }).click();
  await page.getByPlaceholder('Search waypoints').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const detail = page.getByRole('complementary', { name: 'Waypoint details' });
  await expect(detail.getByRole('heading', { name: 'Two photographs' })).toBeFocused();
  await expect(detail.getByRole('img', { name: 'Card symbol' })).toHaveAttribute('src', cardIcon!);
  await detail.getByRole('button', { name: 'Mark as found', exact: true }).click();
  await expect.poll(async () => (await readDraws()).some(row => row.src === cardIcon && row.alpha < 1)).toBe(true);
  await expect(page.getByLabel('Found progress')).toContainText('1 / 8');
  await page.getByRole('button', { name: 'Hide Found', exact: true }).click();
  await page.getByPlaceholder('Search waypoints').fill('Two photographs');
  await expect(page.getByText('No matching visible waypoints.')).toBeVisible();
  await page.getByRole('button', { name: 'Close results' }).click();
  await page.getByRole('button', { name: 'Show Found', exact: true }).click();
  await detail.getByRole('button', { name: 'Close waypoint details' }).click();
  await expect(page.getByPlaceholder('Search waypoints')).toBeFocused();
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await expect(category.locator('.category-row').filter({ hasText: 'Card' })).toContainText('1/3');
  await page.keyboard.press('Escape');
  await expect(category).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Categories', exact: true })).toBeFocused();
});

test.describe('touch gallery', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('swipe changes photograph without changing progress', async ({ page, request }) => {
    await page.goto('/');
    await select(page, 'Two photographs');
    await page.getByRole('button', { name: 'Enlarge photograph' }).tap();
    const dialog = page.getByRole('dialog');
    await dialog.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 280, clientY: 400 }] });
    await dialog.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 90, clientY: 400 }] });
    await expect(dialog.locator('img')).toHaveAttribute('src', /\/api\/assets\/photo-two$/);
    await dialog.getByRole('button', { name: 'Close gallery' }).tap();
    expect(await (await request.get(`${api}/progress`)).json()).toEqual([]);
  });
});

test('map canvas hit testing survives zoom and pan', async ({ page }) => {
  await page.goto('/');
  const map = page.locator('.leaflet-container');
  await expect(page.locator('.waypoint-canvas')).toBeVisible();
  const rect = (await map.boundingBox())!;
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await expect.poll(() => page.locator('.waypoint-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const ratio = window.devicePixelRatio;
    return canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, ratio, ratio).data[3];
  })).toBeGreaterThan(0);
  await page.mouse.click(center.x, center.y);
  await expect(page.getByRole('heading', { name: 'Two photographs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close waypoint details' }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(1);
  await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.locator('.waypoint-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const ratio = window.devicePixelRatio;
    return canvas.getContext('2d')!.getImageData(canvas.width / 2 - 80 * ratio, canvas.height / 2, ratio, ratio).data[3];
  })).toBeGreaterThan(0);
  await page.mouse.click(center.x - 80, center.y);
  await expect(page.getByRole('heading', { name: 'Two photographs', exact: true })).toBeVisible();
});
