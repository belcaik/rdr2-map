import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from rdr2_extractor.normalize import normalize
from source_fixture import capture
from rdr2_extractor.contract import validate
from rdr2_extractor.media import store_image, valid_existing, download, safe_url, atomic

class PipelineTests(unittest.TestCase):
    def test_capture_preserves_associations_and_does_not_treat_icon_as_photo(self):
        source = capture()
        data = normalize(source, sample=0)
        validate(data)
        self.assertEqual([p['imageDiscovery'] for p in data['waypoints']], ['none', 'present', 'uninspected'])
        self.assertEqual(len(data['waypoints'][1]['images']), 2)
        self.assertEqual([p['id'] for p in data['waypoints']], [100, 101, 102])
        self.assertEqual([i['order'] for i in data['waypoints'][1]['images']], [0, 1])
        self.assertEqual(data['tiles'], [])
        self.assertFalse(data['coverage']['tilesComplete'])

class MediaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def photo(self, fmt='JPEG'):
        buffer = io.BytesIO()
        Image.new('RGB', (12, 8), 'red').save(buffer, fmt)
        return buffer.getvalue()

    def test_photos_keep_efficient_encoding_and_actual_mime(self):
        content = self.photo()
        first = store_image(content, 'image/png', 'waypoint-image', self.root)
        second = store_image(content, 'image/jpeg', 'waypoint-image', self.root)
        self.assertEqual(first['mime'], 'image/jpeg')
        self.assertTrue(first['path'].endswith('.jpg'))
        self.assertEqual(first['path'], second['path'])
        self.assertEqual(first['bytes'], len(content))
        self.assertTrue(valid_existing(first, self.root))
        (self.root / first['path']).write_bytes(b'interrupted')
        self.assertFalse(valid_existing(first, self.root))
        self.assertTrue(valid_existing(store_image(content, 'image/jpeg', 'waypoint-image', self.root), self.root))

    def test_corrupt_html_svg_and_output_escape_are_rejected(self):
        for content, mime in [(b'<html>error</html>', 'image/png'), (self.photo(), 'text/html'), (b'<svg onload="alert(1)"/>', 'image/svg+xml')]:
            with self.assertRaises(Exception):
                store_image(content, mime, 'waypoint-image', self.root)
        record = dict(status='downloaded', path='../escaped.jpg', sha256='0' * 64)
        with self.assertRaisesRegex(ValueError, 'outside'):
            valid_existing(record, self.root)
        (self.root / 'images').symlink_to(self.root.parent, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'outside'):
            store_image(self.photo(), 'image/jpeg', 'waypoint-image', self.root)

    def test_interrupted_atomic_write_keeps_previous_file(self):
        target = self.root / 'dataset.json'
        target.write_bytes(b'previous')
        with patch('pathlib.Path.replace', side_effect=OSError('interrupted')):
            with self.assertRaises(OSError):
                atomic(target, b'new')
        self.assertEqual(target.read_bytes(), b'previous')
        self.assertEqual(list(self.root.glob('*.tmp')), [])

    def test_retry_after_timeouts_and_404_are_explicit(self):
        responses = iter([{'status': 429, 'retryAfter': '2'}, {'status': 200, 'body': b'ok', 'mime': 'image/jpeg'}])
        waits = []
        self.assertEqual(download(lambda _: next(responses), 'fixture', sleep=waits.append)[0], b'ok')
        self.assertEqual(waits, [2])
        with self.assertRaisesRegex(ValueError, '404'):
            download(lambda _: {'status': 404}, 'fixture')
        with self.assertRaisesRegex(ValueError, 'Retry-After'):
            download(lambda _: {'status': 429, 'retryAfter': '999'}, 'fixture')
        with self.assertRaises(TimeoutError):
            download(lambda _: (_ for _ in ()).throw(TimeoutError()), 'fixture', retries=1, sleep=lambda _: None)

    def test_untrusted_urls_are_rejected_before_request(self):
        for url in ['http://rdr2map.com/a', 'https://evil.test/a', 'file:///etc/passwd', 'https://user@rdr2map.com/a', 'https://rdr2map.com:8443/a']:
            with self.assertRaises(ValueError):
                safe_url(url)
        with patch('socket.getaddrinfo', return_value=[(None, None, None, None, ('127.0.0.1', 443))]):
            with self.assertRaisesRegex(ValueError, 'Non-public'):
                safe_url('https://rdr2map.com/a')

    def test_resume_repairs_corrupt_file_and_preserves_gallery_relations(self):
        from rdr2_extractor.pipeline import enrich
        data = normalize(capture(), sample=0)
        calls = []
        def transport(url):
            calls.append(url)
            return dict(status=200, body=self.photo('PNG'), mime='image/png')
        enrich(data, self.root, transport)
        self.assertEqual(len(data['waypoints'][1]['images']), 2)
        photos = [a for a in data['assets'] if a['kind'] == 'waypoint-image']
        self.assertEqual(photos[0]['path'], photos[1]['path'])
        initial_calls = len(calls)
        enrich(data, self.root, transport)
        self.assertEqual(len(calls), initial_calls)
        (self.root / photos[0]['path']).write_bytes(b'bad')
        enrich(data, self.root, transport)
        self.assertEqual(len(calls), initial_calls + 1)
        self.assertEqual(data['waypoints'][1]['images'][0]['attribution'], 'Author')
        validate(data)

class ContractTests(unittest.TestCase):
    def test_wrong_kind_duplicate_identity_and_order_fail(self):
        data = normalize(capture())
        for mutate in [lambda d: d['waypoints'].append(copy.deepcopy(d['waypoints'][0])),
                       lambda d: d['waypoints'][1]['images'][0].update(assetId='icon-36'),
                       lambda d: d['waypoints'][1]['images'][0].update(order=9),
                       lambda d: d['waypoints'][0]['coordinates'].update(x=float('nan'))]:
            invalid = copy.deepcopy(data)
            mutate(invalid)
            with self.assertRaises(Exception):
                validate(invalid)

    def test_relative_embedded_images_and_discovery_failures(self):
        source = capture()
        source['locations']['locations'][0]['description'] = '<img data-src="/lazy.jpg"><img srcset="small.jpg 1x, large.jpg 2x"> ![caption](last.jpg)'
        source['locations']['locations'][2]['media'] = None
        data = normalize(source)
        validate(data)
        self.assertEqual(len(data['waypoints'][0]['images']), 3)
        self.assertEqual(data['waypoints'][2]['imageDiscovery'], 'failed')
        self.assertTrue(data['waypoints'][2]['discoveryError'])

    def test_partial_coverage_and_unknown_icons_are_honest(self):
        source = capture()
        source['window']['mapData']['categories']['36']['locations_count'] = 12
        source['sprite'] = {}
        data = normalize(source)
        self.assertFalse(data['coverage']['complete'])
        self.assertTrue(data['coverage']['omissions'])
        self.assertIsNone(data['categories'][0]['iconAssetId'])
        self.assertTrue(data['categories'][0]['iconReason'])
        validate(data)

class BrowserFailureTests(unittest.TestCase):
    def test_browser_timeout_becomes_reportable_transport_failure(self):
        from selenium.common.exceptions import TimeoutException
        from unittest.mock import MagicMock
        from rdr2_extractor.browser import Browser
        browser = Browser.__new__(Browser)
        browser.driver = MagicMock()
        browser.driver.execute_async_script.side_effect = TimeoutException('timed out')
        with patch('rdr2_extractor.browser.safe_url'):
            response = browser.fetch('https://media.mapgenie.io/photo.jpg')
        self.assertEqual(response['status'], 0)
        self.assertIn('timed out', response['error'])

class LegacyCoverageTests(unittest.TestCase):
    def test_capture_without_enumeration_counts_cannot_claim_complete(self):
        data = normalize(capture(), sample=0)
        self.assertFalse(data['coverage']['complete'])
        self.assertTrue(any('unverified' in note.lower() for note in data['coverage']['omissions']))

class ReviewRegressionTests(unittest.TestCase):
    def test_null_mime_and_decompression_bomb_become_reported_failures(self):
        from rdr2_extractor.pipeline import enrich
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = normalize(capture())
            enrich(data, root, lambda _: dict(status=200, body=b'bad', mime=None), retries=0)
            self.assertTrue(all(a['status'] == 'failed' for a in data['assets']))
            self.assertFalse(data['coverage']['mediaComplete'])
        with patch('rdr2_extractor.media.Image.open', side_effect=Image.DecompressionBombError('huge image')):
            with self.assertRaises(ValueError):
                store_image(b'encoded', 'image/png', 'waypoint-image', Path('/unused'))

    def test_missing_category_icon_cannot_claim_complete_media(self):
        from rdr2_extractor.pipeline import enrich
        source = capture()
        source['sprite'] = {}
        source['locations']['locations'] = [source['locations']['locations'][0]]
        data = normalize(source)
        with tempfile.TemporaryDirectory() as directory:
            enrich(data, Path(directory), lambda _: self.fail('No downloads expected'))
        self.assertFalse(data['coverage']['mediaComplete'])
        data['coverage']['mediaComplete'] = True
        with self.assertRaisesRegex(ValueError, 'Incomplete media'):
            validate(data)

class CheckpointTests(unittest.TestCase):
    def test_batch_checkpoint_flushes_completed_asset_on_interruption(self):
        from rdr2_extractor.pipeline import enrich
        data = normalize(capture())
        photo = io.BytesIO()
        Image.new('RGB', (12, 8), 'red').save(photo, 'PNG')
        calls = []
        def transport(url):
            calls.append(url)
            if len(calls) == 3:
                raise KeyboardInterrupt()
            return dict(status=200, body=photo.getvalue(), mime='image/png')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch('rdr2_extractor.pipeline.save_json', wraps=__import__('rdr2_extractor.media', fromlist=['save_json']).save_json) as save:
                with self.assertRaises(KeyboardInterrupt):
                    enrich(data, root, transport)
                self.assertEqual(save.call_count, 1)
            persisted = validate(json.loads((root / 'dataset.json').read_text()))
            self.assertEqual([a['status'] for a in persisted['assets']], ['downloaded', 'downloaded', 'pending'])
            self.assertFalse(persisted['coverage']['mediaComplete'])

if __name__ == '__main__':
    unittest.main()
