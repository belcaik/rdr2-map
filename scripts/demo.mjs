import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const sharp = require('sharp');

// Synthetic geometry only; no source media or session data enters the repository.
export async function createDemo(root) {
  const assets = [];
  async function asset(id, kind, shape, format = 'png') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#251c16"/>${shape}</svg>`;
    const bytes = await sharp(Buffer.from(svg))[format]().toBuffer();
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const ext = format === 'jpeg' ? 'jpg' : format;
    const relative = `${kind === 'category-icon' ? 'icons' : 'images'}/${hash}.${ext}`;
    await fs.mkdir(path.join(root, path.dirname(relative)), { recursive: true });
    await fs.writeFile(path.join(root, relative), bytes);
    assets.push({ id, kind, sourceUrl: `https://rdr2map.com/synthetic/${id}`, path: relative, mime: `image/${format}`, bytes: bytes.length, width: 96, height: 96, sha256: hash, status: 'downloaded', error: null });
  }
  await asset('icon-card', 'category-icon', '<rect x="28" y="18" width="40" height="60" fill="#f5dfab"/>');
  await asset('icon-bone', 'category-icon', '<path d="M20 72L72 20" stroke="#f5dfab" stroke-width="18"/>');
  await asset('icon-shop', 'category-icon', '<circle cx="48" cy="48" r="28" fill="#f5dfab"/>');
  await asset('photo-one', 'waypoint-image', '<path d="M0 90L42 20L96 90" fill="#c77d36"/>', 'jpeg');
  await asset('photo-two', 'waypoint-image', '<circle cx="48" cy="48" r="30" fill="#6a9b79"/>', 'webp');
  const unavailable = (id, status) => ({ id, kind: 'waypoint-image', sourceUrl: `https://rdr2map.com/synthetic/${id}`, path: null, mime: null, bytes: null, width: null, height: null, sha256: null, status, error: status === 'failed' ? 'Source returned HTTP 404' : null });
  assets.push(unavailable('photo-pending', 'pending'), unavailable('photo-failed', 'failed'));
  const image = (assetId, order, caption) => ({ assetId, order, caption, attribution: 'Synthetic test fixture' });
  const titles = ['Two photographs', 'One photograph', 'No photographs', 'Not inspected', 'Discovery failed', 'Download pending', 'Download failed', 'HTML description'];
  const waypoints = titles.map((title, i) => ({ id: 1001 + i, mapId: '1', categoryId: (i % 3) + 1, title, description: '**Reference notes** with a [source link](https://rdr2map.com/). ![remote](https://invalid.example/hidden.jpg)', descriptionFormat: 'markdown', coordinates: { x: 30 + (i % 3) * 3, y: 45 + Math.floor(i / 3) * 3 }, sourceUrl: `https://rdr2map.com/?locationIds=${1001 + i}`, images: [], imageDiscovery: 'none', discoveryError: null }));
  waypoints[0].images = [image('photo-one', 0, 'First view'), image('photo-two', 1, 'Second view')];
  waypoints[1].images = [image('photo-one', 0, 'Shared file, separate caption')];
  for (const i of [0, 1]) waypoints[i].imageDiscovery = 'present';
  waypoints[3].imageDiscovery = 'uninspected';
  waypoints[4].imageDiscovery = 'failed'; waypoints[4].discoveryError = 'Detail request timed out';
  for (const [i, id] of [[5, 'photo-pending'], [6, 'photo-failed']]) { waypoints[i].imageDiscovery = 'present'; waypoints[i].images = [image(id, 0, null)]; }
  waypoints[7].descriptionFormat = 'html';
  waypoints[7].description = '<strong>Safe formatting</strong><script>window.injected=true</script><img src="https://invalid.example/hidden.jpg" onerror="window.injected=true"><a href="javascript:alert(1)">Unsafe link</a>';
  const data = { schemaVersion: 1, gameId: 'rdr2', source: { url: 'https://rdr2map.com/', kind: 'synthetic', evidence: 'Generated geometry; not source discovery evidence' }, extractedAt: '2026-01-01T00:00:00Z', runId: 'synthetic-demo-v1', maps: [{ id: '1', name: 'RDR2', crs: 'EPSG3857', axes: 'x=latitude,y=longitude', transform: [1, 0, 0, 0, 1, 0], bounds: [[-70, -180], [85, 180]], tileSize: 256, minZoom: 2, maxZoom: 6, tileScheme: 'xyz', tileTemplate: '/api/tiles/{z}/{x}/{y}.jpg', evidence: 'Preserved existing local map configuration; source projection independently observed' }], categories: ['Card', 'Bone', 'Shop'].map((name, i) => ({ id: i + 1, name, group: 'Synthetic places', groupId: 1, iconName: name.toLowerCase(), iconAssetId: ['icon-card', 'icon-bone', 'icon-shop'][i], iconReason: null })), waypoints, assets, tiles: [], coverage: { complete: false, scopeMapIds: ['1'], discovered: 8, filters: ['synthetic sample'], omissions: [], mediaComplete: false, tilesComplete: false } };
  await fs.writeFile(path.join(root, 'dataset.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const root = path.resolve(process.argv[2] ?? 'data/demo');
  await createDemo(root);
  console.log(path.join(root, 'dataset.json'));
}
