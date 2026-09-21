import Ajv from 'ajv';
import schema from '../schemas/dataset.schema.json';
import type { Dataset } from './contract';

const validate = new Ajv({ allErrors: true, strict: false }).compile<Dataset>(schema);
const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export function validateDataset(input: unknown): Dataset {
  if (!validate(input)) throw new Error('Invalid dataset: ' + JSON.stringify(validate.errors));
  const data = input;
  const require = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const unique = (values: (string | number)[], name: string) => require(new Set(values).size === values.length, 'Duplicate ' + name);
  unique(data.maps.map(x => x.id), 'map');
  unique(data.categories.map(x => x.id), 'category');
  unique(data.waypoints.map(x => x.id), 'waypoint');
  unique(data.assets.map(x => x.id), 'asset');
  const maps = new Map(data.maps.map(x => [x.id, x]));
  const categories = new Set(data.categories.map(x => x.id));
  const assets = new Map(data.assets.map(x => [x.id, x]));
  require(maps.size > 0, 'Map configuration required');
  require(data.coverage.discovered >= data.waypoints.length, 'Invalid discovered count');
  require(data.coverage.scopeMapIds.every(id => maps.has(id)), 'Unknown coverage scope');
  for (const map of data.maps) {
    require(map.crs === 'EPSG3857' && map.axes === 'x=latitude,y=longitude', 'Unsupported RDR2 projection');
    require(JSON.stringify(map.transform) === '[1,0,0,0,1,0]', 'Unsupported RDR2 transform');
    require(map.bounds.flat().every(Number.isFinite) && map.bounds[0][0] < map.bounds[1][0] && map.bounds[0][1] < map.bounds[1][1], 'Invalid bounds');
    require(map.minZoom <= map.maxZoom && map.maxZoom <= 22, 'Invalid zoom');
    require(map.tileTemplate === '/api/tiles/{z}/{x}/{y}.jpg' && map.tileScheme === 'xyz', 'Unsupported tiles');
  }
  for (const asset of data.assets) {
    if (asset.status === 'downloaded') {
      require(asset.sha256 && asset.mime && asset.bytes && asset.width && asset.height, 'Downloaded asset lacks metadata');
      require(asset.path === (asset.kind === 'category-icon' ? 'icons/' : 'images/') + asset.sha256 + '.' + extensions[asset.mime ?? ''], 'Asset path/hash/MIME mismatch');
    } else require(asset.path === null, 'Undownloaded asset has a path');
    require(asset.status !== 'failed' || asset.error, 'Failed asset lacks reason');
  }
  for (const category of data.categories) {
    require(category.iconAssetId ? assets.get(category.iconAssetId)?.kind === 'category-icon' : category.iconReason, 'Invalid category icon');
  }
  for (const point of data.waypoints) {
    const map = maps.get(point.mapId);
    require(map && categories.has(point.categoryId), 'Orphan waypoint');
    require(data.coverage.scopeMapIds.includes(point.mapId), 'Waypoint outside coverage scope');
    const { x, y } = point.coordinates;
    require(Number.isFinite(x) && Number.isFinite(y), 'Non-finite coordinates');
    if (map) require(x >= map.bounds[0][0] && x <= map.bounds[1][0] && y >= map.bounds[0][1] && y <= map.bounds[1][1], 'Coordinates outside bounds');
    unique(point.images.map(x => x.order), 'image order');
    require(point.images.every((image, i) => assets.get(image.assetId)?.kind === 'waypoint-image' && image.order === i), 'Invalid image reference/order');
    require(point.imageDiscovery === 'present' ? point.images.length > 0 : point.images.length === 0, 'Discovery/images mismatch');
    require(point.imageDiscovery !== 'failed' || point.discoveryError, 'Failed discovery lacks reason');
  }
  unique(data.tiles.map(t => `${t.mapId}/${t.z}/${t.x}/${t.y}`), 'tile');
  for (const tile of data.tiles) {
    const map = maps.get(tile.mapId);
    require(map && tile.z >= map.minZoom && tile.z <= map.maxZoom, 'Invalid tile map/zoom');
    require(tile.status === 'downloaded' ? tile.sha256 && tile.path : tile.path === null, 'Invalid tile status/path');
    require(tile.status !== 'failed' || tile.error, 'Failed tile lacks reason');
  }
  if (data.coverage.complete) require(data.coverage.filters.length === 0 && data.coverage.omissions.length === 0 && data.coverage.discovered === data.waypoints.length, 'Incomplete waypoint coverage');
  if (data.coverage.mediaComplete) require(data.categories.every(c => c.iconAssetId !== null) && data.waypoints.every(p => p.imageDiscovery === 'none' || p.imageDiscovery === 'present') && data.assets.every(a => a.status === 'downloaded'), 'Incomplete media');
  if (data.coverage.tilesComplete) require(data.tiles.length > 0 && data.tiles.every(t => t.status === 'downloaded'), 'Incomplete tiles');
  return data;
}
