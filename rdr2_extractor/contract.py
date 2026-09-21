"""Python counterpart of shared/validate.ts; both consume the same schema."""
import json
import math
from pathlib import Path
from jsonschema import Draft7Validator

SCHEMA = json.loads((Path(__file__).resolve().parents[1] / 'schemas/dataset.schema.json').read_text())
EXTENSIONS = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique(values, name):
    require(len(values) == len(set(values)), 'Duplicate ' + name)


def validate(data):
    Draft7Validator(SCHEMA).validate(data)
    for collection in ('maps', 'categories', 'waypoints', 'assets'):
        unique([x['id'] for x in data[collection]], collection)
    maps = {x['id']: x for x in data['maps']}
    categories = {x['id'] for x in data['categories']}
    assets = {x['id']: x for x in data['assets']}
    coverage = data['coverage']
    require(maps, 'Map configuration required')
    require(coverage['discovered'] >= len(data['waypoints']), 'Invalid discovered count')
    require(all(i in maps for i in coverage['scopeMapIds']), 'Unknown coverage scope')
    for m in maps.values():
        require(m['crs'] == 'EPSG3857' and m['axes'] == 'x=latitude,y=longitude', 'Unsupported RDR2 projection')
        require(m['transform'] == [1, 0, 0, 0, 1, 0], 'Unsupported RDR2 transform')
        b = m['bounds']
        require(all(math.isfinite(x) for corner in b for x in corner) and b[0][0] < b[1][0] and b[0][1] < b[1][1], 'Invalid bounds')
        require(m['minZoom'] <= m['maxZoom'] <= 22, 'Invalid zoom')
        require(m['tileTemplate'] == '/api/tiles/{z}/{x}/{y}.jpg' and m['tileScheme'] == 'xyz', 'Unsupported tiles')
    for a in assets.values():
        if a['status'] == 'downloaded':
            require(all(a[k] for k in ('sha256', 'mime', 'bytes', 'width', 'height')), 'Downloaded asset lacks metadata')
            folder = 'icons/' if a['kind'] == 'category-icon' else 'images/'
            require(a['path'] == folder + a['sha256'] + '.' + EXTENSIONS[a['mime']], 'Asset path/hash/MIME mismatch')
        else:
            require(a['path'] is None, 'Undownloaded asset has a path')
        require(a['status'] != 'failed' or a['error'], 'Failed asset lacks reason')
    for c in data['categories']:
        require(assets.get(c['iconAssetId'], {}).get('kind') == 'category-icon' if c['iconAssetId'] else c['iconReason'], 'Invalid category icon')
    for p in data['waypoints']:
        require(p['mapId'] in maps and p['categoryId'] in categories, 'Orphan waypoint')
        require(p['mapId'] in coverage['scopeMapIds'], 'Waypoint outside coverage scope')
        x, y = p['coordinates']['x'], p['coordinates']['y']
        require(math.isfinite(x) and math.isfinite(y), 'Non-finite coordinates')
        b = maps[p['mapId']]['bounds']
        require(b[0][0] <= x <= b[1][0] and b[0][1] <= y <= b[1][1], 'Coordinates outside bounds')
        unique([i['order'] for i in p['images']], 'image order')
        require(all(assets.get(i['assetId'], {}).get('kind') == 'waypoint-image' and i['order'] == n for n, i in enumerate(p['images'])), 'Invalid image reference/order')
        require(bool(p['images']) == (p['imageDiscovery'] == 'present'), 'Discovery/images mismatch')
        require(p['imageDiscovery'] != 'failed' or p['discoveryError'], 'Failed discovery lacks reason')
    unique([(t['mapId'], t['z'], t['x'], t['y']) for t in data['tiles']], 'tile')
    for t in data['tiles']:
        require(t['mapId'] in maps and maps[t['mapId']]['minZoom'] <= t['z'] <= maps[t['mapId']]['maxZoom'], 'Invalid tile map/zoom')
        require(bool(t['sha256'] and t['path']) if t['status'] == 'downloaded' else t['path'] is None, 'Invalid tile status/path')
        require(t['status'] != 'failed' or t['error'], 'Failed tile lacks reason')
    if coverage['complete']:
        require(not coverage['filters'] and not coverage['omissions'] and coverage['discovered'] == len(data['waypoints']), 'Incomplete waypoint coverage')
    if coverage['mediaComplete']:
        require(all(p['imageDiscovery'] in ('none', 'present') for p in data['waypoints']) and all(a['status'] == 'downloaded' for a in assets.values()) and all(c['iconAssetId'] for c in data['categories']), 'Incomplete media')
    if coverage['tilesComplete']:
        require(data['tiles'] and all(t['status'] == 'downloaded' for t in data['tiles']), 'Incomplete tiles')
    return data
