#!/usr/bin/env python3
"""Optional tile maintenance. Dataset/media extraction uses rdr2_extractor.pipeline."""
import argparse
import asyncio
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tiles-only', action='store_true', required=True)
    parser.add_argument('--config', default=str(Path(__file__).parent / 'config/default.json'))
    parser.add_argument('--zoom-levels', type=int, nargs='+', choices=range(7))
    parser.add_argument('--rate-limit', type=float)
    parser.add_argument('--max-concurrent', type=int)
    parser.add_argument('--force-download', action='store_true')
    args = parser.parse_args()
    from src.tile_downloader import TileDownloader
    from src.utils.config import Config
    config = Config(args.config)
    rate = args.rate_limit if args.rate_limit is not None else config.get('download.rate_limit', 0.5)
    concurrency = args.max_concurrent or config.get('download.max_concurrent', 3)
    if rate < 0 or concurrency < 1:
        parser.error('Rate must be nonnegative and concurrency positive')
    downloader = TileDownloader(
        output_dir=config.get('output.tiles', 'data/tiles'),
        rate_limit=rate,
        max_concurrent=concurrency,
        timeout=config.get('download.timeout', 30),
        retry_attempts=config.get('download.retry_attempts', 3),
    )
    report = asyncio.run(downloader.download_rdr2_tiles(
        zoom_levels=args.zoom_levels or config.get('tiles.zoom_levels', [2, 3, 4, 5, 6]),
        skip_existing=not args.force_download,
    ))
    print(json.dumps(report, indent=2))
    return int(report['failed_downloads'] > 0)


if __name__ == '__main__':
    raise SystemExit(main())
