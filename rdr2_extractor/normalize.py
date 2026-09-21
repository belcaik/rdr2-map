"""Normalize observed RDR2 captures without depending on viewport or tiles."""
import hashlib
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin


class EmbeddedImages(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attributes):
        if tag == 'img':
            attrs = dict(attributes)
            source = attrs.get('data-src') or attrs.get('src')
            if not source and attrs.get('srcset'):
                source = attrs['srcset'].split(',')[-1].strip().split()[0]
            if source:
                self.urls.append(source)


def description_images(text):
    parser = EmbeddedImages()
    parser.feed(text)
    return parser.urls + re.findall(r'!\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)', text)


def asset(identifier, kind, source):
    return dict(id=identifier, kind=kind, sourceUrl=source, path=None, mime=None,
                bytes=None, width=None, height=None, sha256=None, status='pending', error=None)


def normalize(capture, sample=0, category_ids=()):
    window = capture['window']['mapData']
    if window['map']['id'] != 1:
        raise ValueError('Only observed RDR2 map 1 is supported')
    source = capture['sourceUrl'].split('?')[0]
    groups = {g['id']: g['title'] for g in window['groups']}
    all_points = capture['locations']['locations']
    points = [p for p in all_points if not category_ids or p['category_id'] in category_ids]
    if sample:
        preferred = [743, 56, 91, 158, 681, 682]
        points.sort(key=lambda p: preferred.index(p['id']) if p['id'] in preferred else len(preferred))
        points = points[:sample]
    assets, categories, waypoints, omissions = {}, [], [], []
    sprite_url = next((r['url'] for r in capture.get('responses', [])
                       if '/games/rdr2/markers/markers.png' in r['url']), None)
    for category in window['categories'].values():
        if category_ids and category['id'] not in category_ids:
            continue
        icon_name = category.get('icon')
        rectangle = capture.get('sprite', {}).get(icon_name)
        icon_id = 'icon-' + str(category['id'])
        if rectangle and sprite_url:
            icon = asset(icon_id, 'category-icon', sprite_url)
            icon['sprite'] = dict(name=icon_name, **{k: rectangle[k] for k in ('x', 'y', 'width', 'height')})
            assets[icon_id] = icon
        categories.append(dict(id=category['id'], name=category['title'], group=groups.get(category.get('group_id')),
                               groupId=category.get('group_id'), iconName=icon_name,
                               iconAssetId=icon_id if icon_id in assets else None,
                               iconReason=None if icon_id in assets else 'Category symbol has no verified sprite capture'))
        observed = sum(p['category_id'] == category['id'] for p in all_points)
        if 'locations_count' not in category:
            omissions.append(f"Category {category['id']}: enumeration count unverified in capture")
        if category.get('locations_count', observed) != observed:
            omissions.append(f"Category {category['id']}: source declares {category['locations_count']} locations; public capture contains {observed}")
    for point in points:
        if point.get('map_id', 1) != 1:
            raise ValueError('Waypoint belongs to a different map')
        images = []
        discovery = 'none' if 'media' in point else 'uninspected'
        error = None
        media_entries = point.get('media', [])
        if not isinstance(media_entries, list):
            media_entries = []
            discovery, error = 'failed', 'Malformed source media array'
        for media in sorted(media_entries, key=lambda m: m.get('order', 0)):
            if media.get('type') != 'image':
                omissions.append(f"Waypoint {point['id']}: unsupported media type {media.get('type')}")
                continue
            identifier = 'media-' + str(media['id'])
            url = urljoin(source, media['url'])
            if identifier in assets and assets[identifier]['sourceUrl'] != url:
                raise ValueError('Conflicting source media identity ' + identifier)
            assets[identifier] = asset(identifier, 'waypoint-image', url)
            images.append(dict(assetId=identifier, order=len(images), caption=media.get('title') or None,
                               attribution=media.get('attribution') or None))
        for url in description_images(point.get('description') or ''):
            resolved = urljoin(source, url)
            if any(assets[i['assetId']]['sourceUrl'] == resolved for i in images):
                continue
            identifier = 'embedded-' + hashlib.sha256(resolved.encode()).hexdigest()
            assets[identifier] = asset(identifier, 'waypoint-image', resolved)
            images.append(dict(assetId=identifier, order=len(images), caption=None, attribution=None))
        if images:
            discovery, error = 'present', None
        waypoints.append(dict(id=point['id'], mapId='1', categoryId=point['category_id'], title=point['title'],
                              description=point.get('description') or '', descriptionFormat='markdown',
                              coordinates=dict(x=float(point['latitude']), y=float(point['longitude'])),
                              sourceUrl=source + '?locationIds=' + str(point['id']), images=images,
                              imageDiscovery=discovery, discoveryError=error))
    now = datetime.now(timezone.utc).isoformat()
    filters = ([f'sample={sample}'] if sample else []) + ([f'categories={list(category_ids)}'] if category_ids else [])
    return dict(schemaVersion=1, gameId='rdr2', source=dict(url=source, kind='capture', evidence='Observed RDR2 mapData, public map data response and marker sprite'),
                extractedAt=now, runId=hashlib.sha256(now.encode()).hexdigest()[:16], categories=categories,
                waypoints=waypoints, assets=list(assets.values()), tiles=[],
                maps=[dict(id='1', name='Red Dead Redemption 2 / Default', crs='EPSG3857', axes='x=latitude,y=longitude',
                           transform=[1, 0, 0, 0, 1, 0], bounds=[[-70, -180], [85.0511287798066, 180]],
                           tileSize=256, minZoom=2, maxZoom=6, tileScheme='xyz', tileTemplate='/api/tiles/{z}/{x}/{y}.jpg',
                           evidence='RDR2 mapData and MapLibre raster inspected 2026-09-21; preserve existing local zoom 2-6 and XYZ JPEG route')],
                coverage=dict(complete=not filters and not omissions, scopeMapIds=['1'], mediaComplete=False,
                              tilesComplete=False, discovered=len(all_points), filters=filters, omissions=omissions))
