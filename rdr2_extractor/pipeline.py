"""Canonical RDR2 dataset producer. Existing tiles are independent of enrichment."""
import argparse
import io
import json
from collections import Counter
from pathlib import Path
from PIL import Image
from rdr2_extractor.browser import Browser
from rdr2_extractor.contract import validate
from rdr2_extractor.media import decode_image, download, save_json, store_image, valid_existing
from rdr2_extractor.normalize import normalize


def report(data):
    return dict(categories=len(data['categories']), categoriesWithExtractedIcon=sum(
        a['kind'] == 'category-icon' and a['status'] == 'downloaded' for a in data['assets']),
        missingIcons=[dict(id=c['id'], reason=c['iconReason']) for c in data['categories'] if not c['iconAssetId']],
        waypoints=len(data['waypoints']), coverage=data['coverage'],
        discovery=dict(Counter(p['imageDiscovery'] for p in data['waypoints'])),
        icons=dict(Counter(a['status'] for a in data['assets'] if a['kind'] == 'category-icon')),
        photos=dict(Counter(a['status'] for a in data['assets'] if a['kind'] == 'waypoint-image')),
        storedBytes=sum(a['bytes'] or 0 for a in {a['path']: a for a in data['assets'] if a['path']}.values()),
        failures=[dict(id=a['id'], error=a['error']) for a in data['assets'] if a['status'] == 'failed'])


def enrich(data, output, transport, retries=2):
    sprites = {}
    data['coverage']['mediaComplete'] = False
    changed = 0
    try:
        for item in data['assets']:
            if valid_existing(item, output):
                continue
            try:
                if 'sprite' in item:
                    url = item['sourceUrl']
                    if url not in sprites:
                        content, mime = download(transport, url, retries)
                        decode_image(content, mime)
                        sprites[url] = Image.open(io.BytesIO(content)).convert('RGBA')
                    image = sprites[url]
                    r = item['sprite']
                    bounds = (r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height'])
                    if bounds[0] < 0 or bounds[1] < 0 or bounds[2] > image.width or bounds[3] > image.height:
                        raise ValueError('Sprite crop outside decoded image')
                    buffer = io.BytesIO()
                    image.crop(bounds).save(buffer, 'PNG')
                    content, mime = buffer.getvalue(), 'image/png'
                else:
                    content, mime = download(transport, item['sourceUrl'], retries)
                item.update(store_image(content, mime, item['kind'], output))
            except (OSError, ValueError, TimeoutError) as error:
                item.update(path=None, status='failed', error=str(error)[:400])
            changed += 1
            if changed % 25 == 0:
                save_json(output / 'dataset.json', data)
    finally:
        if changed:
            save_json(output / 'dataset.json', data)
    data['coverage']['mediaComplete'] = all(c['iconAssetId'] for c in data['categories']) and all(a['status'] == 'downloaded' for a in data['assets']) and all(p['imageDiscovery'] in ('none', 'present') for p in data['waypoints'])
    return data


def run(args):
    args.output.mkdir(parents=True, exist_ok=True)
    dataset_path = args.output / 'dataset.json'
    browser = None
    try:
        if args.phase == 'validate':
            data = validate(json.loads(dataset_path.read_text()))
        elif args.resume and dataset_path.exists():
            data = validate(json.loads(dataset_path.read_text()))
        else:
            capture_path = args.capture or args.output / 'capture.json'
            if capture_path.exists():
                capture = json.loads(capture_path.read_text())
            else:
                browser = Browser(args.source_url, args.timeout)
                capture = browser.capture(args.output)
            if args.legacy_capture:
                legacy = json.loads(args.legacy_capture.read_text())['raw_data']['mapData']
                capture = dict(capture, window=dict(capture['window'], mapData=legacy), locations=dict(locations=legacy['locations']))
            if args.phase == 'discover':
                save_json(args.output / 'capture.json', capture)
                return
            data = normalize(capture, args.sample, tuple(args.categories))
            validate(data)
            save_json(dataset_path, data)
        if args.phase == 'download':
            def fetch(url):
                nonlocal browser
                if browser is None:
                    browser = Browser(args.source_url, args.timeout)
                return browser.fetch(url)
            enrich(data, args.output, fetch, args.retries)
        if args.phase != 'normalize':
            for item in data['assets']:
                if item['status'] == 'downloaded' and not valid_existing(item, args.output):
                    raise ValueError('Downloaded file failed validation: ' + item['id'])
        validate(data)
        save_json(dataset_path, data)
        result = report(data)
        save_json(args.output / 'report.json', result)
        print(json.dumps(result, indent=2))
    finally:
        if browser:
            browser.close()


def parser():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--source-url', default='https://rdr2map.com/')
    cli.add_argument('--capture', type=Path, help='Ordinary browser capture.json')
    cli.add_argument('--legacy-capture', type=Path, help='Existing extracted_data JSON; pair with current sprite capture')
    cli.add_argument('--output', type=Path, default=Path('data/sample'))
    cli.add_argument('--sample', type=int, default=6, help='Waypoint limit; 0 includes all public captured points')
    cli.add_argument('--categories', type=int, nargs='*', default=[])
    cli.add_argument('--timeout', type=int, default=40)
    cli.add_argument('--retries', type=int, choices=range(5), default=2)
    cli.add_argument('--resume', action='store_true', help='Reuse original selection and valid downloaded files')
    cli.add_argument('--phase', choices=['discover', 'normalize', 'download', 'validate'], default='download')
    return cli


if __name__ == '__main__':
    args = parser().parse_args()
    if args.sample < 0 or args.timeout < 1:
        raise SystemExit('Sample must be nonnegative and timeout positive')
    run(args)
