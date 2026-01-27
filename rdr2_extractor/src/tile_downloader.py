import asyncio
import json
import logging
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

try:
    import aiohttp
except ImportError:
    aiohttp = None

try:
    from tqdm import tqdm
except ImportError:
    # Fallback tqdm implementation
    class tqdm:
        def __init__(self, total=None, desc="", unit=""):
            self.total = total
            self.desc = desc
            self.current = 0
            print(f"{desc}: Starting...")

        def update(self, n=1):
            self.current += n
            if self.total:
                percent = (self.current / self.total) * 100
                print(
                    f"\r{self.desc}: {self.current}/{self.total} ({percent:.1f}%)",
                    end="",
                    flush=True,
                )

        def close(self):
            print(f"\n{self.desc}: Complete")


try:
    from fake_useragent import UserAgent
except ImportError:
    # Fallback UserAgent implementation
    class UserAgent:
        @property
        def random(self):
            return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


# RDR2 Map tile configuration from mapgenie.io
# URL Pattern: https://tiles.mapgenie.io/games/rdr2/world/atlas-dark-v1/{zoom}/{x}/{y}.jpg
RDR2_TILE_CONFIG = {
    "base_url": "https://tiles.mapgenie.io/games/rdr2/world/atlas-dark-v1",
    "format": "jpg",
    "zoom_levels": {
        0: {"max_x": 0, "max_y": 0, "total": 1},
        1: {"max_x": 1, "max_y": 0, "total": 2},
        2: {"max_x": 3, "max_y": 2, "total": 12},
        3: {"max_x": 7, "max_y": 5, "total": 48},
        4: {"max_x": 15, "max_y": 11, "total": 192},
        5: {"max_x": 31, "max_y": 23, "total": 768},
        6: {"max_x": 63, "max_y": 46, "total": 2961},
    },
    "total_tiles": 3984,  # Sum of all zoom levels
}


@dataclass
class TileRequest:
    url: str
    zoom: int
    x: int
    y: int
    format: str
    output_path: Path


@dataclass
class DownloadProgress:
    """Track download progress for reporting"""

    total: int = 0
    downloaded: int = 0
    skipped: int = 0
    failed: int = 0
    bytes_downloaded: int = 0
    current_zoom: int = 0
    start_time: float = field(default_factory=time.time)

    @property
    def elapsed_seconds(self) -> float:
        return time.time() - self.start_time

    @property
    def tiles_per_second(self) -> float:
        if self.elapsed_seconds > 0:
            return (self.downloaded + self.skipped) / self.elapsed_seconds
        return 0

    @property
    def eta_seconds(self) -> float:
        remaining = self.total - (self.downloaded + self.skipped + self.failed)
        if self.tiles_per_second > 0:
            return remaining / self.tiles_per_second
        return 0


class TileDownloader:
    def __init__(
        self,
        output_dir: str = "data/tiles",
        rate_limit: float = 0.5,
        max_concurrent: int = 5,
        timeout: int = 30,
        retry_attempts: int = 3,
    ):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.rate_limit = rate_limit  # Minimum seconds between requests
        self.max_concurrent = max_concurrent
        self.timeout = timeout
        self.retry_attempts = retry_attempts
        self.logger = logging.getLogger(__name__)

        # Download statistics
        self.stats = {
            "total_requests": 0,
            "successful_downloads": 0,
            "failed_downloads": 0,
            "skipped_existing": 0,
            "bytes_downloaded": 0,
        }

        # Request tracking for rate limiting
        self.last_request_time = 0
        self.request_count = 0

        # User agent rotation
        self.ua = UserAgent()

        # RDR2 specific configuration
        self.tile_config = RDR2_TILE_CONFIG

    def get_rdr2_tile_url(self, zoom: int, x: int, y: int) -> str:
        """Generate tile URL for RDR2 map from mapgenie.io"""
        base_url = self.tile_config["base_url"]
        fmt = self.tile_config["format"]
        return f"{base_url}/{zoom}/{x}/{y}.{fmt}"

    def get_tile_output_path(self, zoom: int, x: int, y: int) -> Path:
        """Get organized output path for tile file.

        Structure: tiles/zoom_{z}/{x}_{y}.jpg
        This structure is optimized for frontend tile serving.
        """
        zoom_dir = self.output_dir / f"zoom_{zoom}"
        zoom_dir.mkdir(parents=True, exist_ok=True)
        fmt = self.tile_config["format"]
        return zoom_dir / f"{x}_{y}.{fmt}"

    def generate_rdr2_tile_requests(
        self, zoom_levels: Optional[List[int]] = None, skip_existing: bool = True
    ) -> List[TileRequest]:
        """Generate all tile requests for RDR2 map.

        Args:
            zoom_levels: Specific zoom levels to download. If None, downloads all.
            skip_existing: Skip tiles that already exist on disk.

        Returns:
            List of TileRequest objects for downloading.
        """
        requests = []
        zoom_config = self.tile_config["zoom_levels"]

        # Use specified zoom levels or all available
        levels_to_download = zoom_levels if zoom_levels else list(zoom_config.keys())

        for zoom in sorted(levels_to_download):
            if zoom not in zoom_config:
                self.logger.warning(f"Zoom level {zoom} not in configuration, skipping")
                continue

            config = zoom_config[zoom]
            max_x = config["max_x"]
            max_y = config["max_y"]

            self.logger.info(
                f"Generating requests for zoom {zoom}: x=0-{max_x}, y=0-{max_y}"
            )

            for x in range(max_x + 1):
                for y in range(max_y + 1):
                    output_path = self.get_tile_output_path(zoom, x, y)

                    # Skip if file exists and skip_existing is True
                    if skip_existing and output_path.exists():
                        self.stats["skipped_existing"] += 1
                        continue

                    url = self.get_rdr2_tile_url(zoom, x, y)

                    requests.append(
                        TileRequest(
                            url=url,
                            zoom=zoom,
                            x=x,
                            y=y,
                            format=self.tile_config["format"],
                            output_path=output_path,
                        )
                    )

        self.logger.info(
            f"Generated {len(requests)} tile requests "
            f"({self.stats['skipped_existing']} existing tiles skipped)"
        )

        return requests

    async def download_rdr2_tiles(
        self, zoom_levels: Optional[List[int]] = None, skip_existing: bool = True
    ) -> Dict[str, Any]:
        """Download RDR2 map tiles from mapgenie.io.

        Args:
            zoom_levels: Specific zoom levels to download. If None, downloads all (0-6).
            skip_existing: Skip tiles that already exist on disk.

        Returns:
            Dictionary with download statistics.
        """
        self.logger.info("=" * 60)
        self.logger.info("Starting RDR2 tile download from mapgenie.io")
        self.logger.info("=" * 60)

        if aiohttp is None:
            self.logger.error("aiohttp not available - cannot download tiles")
            self.logger.error("Install with: pip install aiohttp")
            return self.stats

        # Generate tile requests
        tile_requests = self.generate_rdr2_tile_requests(zoom_levels, skip_existing)

        if not tile_requests:
            self.logger.info("No tiles to download (all tiles may already exist)")
            return self.stats

        # Calculate totals
        total_possible = sum(
            cfg["total"]
            for z, cfg in self.tile_config["zoom_levels"].items()
            if zoom_levels is None or z in zoom_levels
        )

        self.logger.info(f"Total tiles available: {total_possible}")
        self.logger.info(f"Tiles to download: {len(tile_requests)}")
        self.logger.info(f"Tiles already downloaded: {self.stats['skipped_existing']}")
        self.logger.info(f"Rate limit: {self.rate_limit}s between requests")
        self.logger.info(f"Max concurrent: {self.max_concurrent}")

        # Estimate time
        estimated_time = len(tile_requests) * self.rate_limit / self.max_concurrent
        self.logger.info(f"Estimated time: {estimated_time / 60:.1f} minutes")
        self.logger.info("-" * 60)

        # Download tiles
        await self._download_tiles_batch(tile_requests)

        # Save metadata
        self._save_download_metadata(tile_requests)

        # Print summary
        self._print_download_summary()

        return self.stats

    async def _download_tiles_batch(self, tile_requests: List[TileRequest]) -> None:
        """Download tiles in batches with rate limiting and progress tracking."""
        semaphore = asyncio.Semaphore(self.max_concurrent)

        # Group requests by zoom level for organized downloading
        requests_by_zoom = {}
        for req in tile_requests:
            if req.zoom not in requests_by_zoom:
                requests_by_zoom[req.zoom] = []
            requests_by_zoom[req.zoom].append(req)

        # Create shared session for connection pooling
        connector = aiohttp.TCPConnector(
            limit=self.max_concurrent, limit_per_host=self.max_concurrent
        )
        timeout_config = aiohttp.ClientTimeout(total=self.timeout)

        async with aiohttp.ClientSession(
            connector=connector, timeout=timeout_config
        ) as session:
            for zoom in sorted(requests_by_zoom.keys()):
                zoom_requests = requests_by_zoom[zoom]
                self.logger.info(
                    f"\nDownloading zoom level {zoom}: {len(zoom_requests)} tiles"
                )

                # Progress bar for this zoom level
                progress_bar = tqdm(
                    total=len(zoom_requests), desc=f"Zoom {zoom}", unit="tiles"
                )

                # Create tasks for this zoom level
                tasks = [
                    asyncio.create_task(
                        self._download_single_tile(
                            req, session, semaphore, progress_bar
                        )
                    )
                    for req in zoom_requests
                ]

                # Wait for all downloads in this zoom level
                await asyncio.gather(*tasks, return_exceptions=True)

                progress_bar.close()

                # Log zoom level completion
                self.logger.info(
                    f"Zoom {zoom} complete: {self.stats['successful_downloads']} downloaded, "
                    f"{self.stats['failed_downloads']} failed"
                )

    async def _download_single_tile(
        self,
        request: TileRequest,
        session: aiohttp.ClientSession,
        semaphore: asyncio.Semaphore,
        progress_bar: tqdm,
    ) -> bool:
        """Download a single tile with retry logic and rate limiting."""
        async with semaphore:
            # Apply rate limiting
            await self._apply_rate_limit()

            headers = {
                "User-Agent": self.ua.random,
                "Accept": "image/jpeg,image/png,image/*,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate, br",
                "Referer": "https://mapgenie.io/",
                "Origin": "https://mapgenie.io",
                "DNT": "1",
                "Connection": "keep-alive",
            }

            for attempt in range(self.retry_attempts):
                try:
                    async with session.get(request.url, headers=headers) as response:
                        if response.status == 200:
                            content = await response.read()

                            # Validate content
                            if len(content) < 100:
                                self.logger.warning(
                                    f"Tile too small ({len(content)} bytes): {request.url}"
                                )
                                continue

                            # Save tile
                            request.output_path.parent.mkdir(
                                parents=True, exist_ok=True
                            )
                            with open(request.output_path, "wb") as f:
                                f.write(content)

                            self.stats["successful_downloads"] += 1
                            self.stats["bytes_downloaded"] += len(content)
                            self.stats["total_requests"] += 1

                            progress_bar.update(1)
                            return True

                        elif response.status == 403:
                            self.logger.warning(f"Access denied (403): {request.url}")
                            self.stats["failed_downloads"] += 1
                            self.stats["total_requests"] += 1
                            progress_bar.update(1)
                            return False

                        elif response.status == 429:
                            # Rate limited - wait and retry
                            wait_time = 5 * (attempt + 1)
                            self.logger.warning(
                                f"Rate limited, waiting {wait_time}s..."
                            )
                            await asyncio.sleep(wait_time)
                            continue

                        else:
                            self.logger.warning(
                                f"HTTP {response.status}: {request.url}"
                            )
                            if attempt < self.retry_attempts - 1:
                                await asyncio.sleep(1)
                                continue

                except asyncio.TimeoutError:
                    self.logger.warning(
                        f"Timeout (attempt {attempt + 1}): {request.url}"
                    )
                    if attempt < self.retry_attempts - 1:
                        await asyncio.sleep(2)
                        continue

                except Exception as e:
                    self.logger.error(f"Error downloading {request.url}: {e}")
                    if attempt < self.retry_attempts - 1:
                        await asyncio.sleep(1)
                        continue

            # All retries failed
            self.stats["failed_downloads"] += 1
            self.stats["total_requests"] += 1
            progress_bar.update(1)
            return False

    async def _apply_rate_limit(self) -> None:
        """Apply rate limiting between requests with jitter."""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time

        if time_since_last < self.rate_limit:
            sleep_time = self.rate_limit - time_since_last
            # Add random jitter (0-30% of rate limit)
            sleep_time += random.uniform(0, self.rate_limit * 0.3)
            await asyncio.sleep(sleep_time)

        self.last_request_time = time.time()
        self.request_count += 1

    def _save_download_metadata(self, requests: List[TileRequest]) -> None:
        """Save metadata about the download session."""
        # Collect info about downloaded tiles
        downloaded_tiles = []
        for zoom_dir in self.output_dir.iterdir():
            if zoom_dir.is_dir() and zoom_dir.name.startswith("zoom_"):
                try:
                    zoom = int(zoom_dir.name.split("_")[1])
                    for tile_file in zoom_dir.glob("*.*"):
                        parts = tile_file.stem.split("_")
                        if len(parts) == 2:
                            x, y = int(parts[0]), int(parts[1])
                            downloaded_tiles.append(
                                {
                                    "zoom": zoom,
                                    "x": x,
                                    "y": y,
                                    "file": str(tile_file.relative_to(self.output_dir)),
                                    "size": tile_file.stat().st_size,
                                }
                            )
                except (ValueError, IndexError):
                    continue

        metadata = {
            "tile_source": "mapgenie.io",
            "base_url": self.tile_config["base_url"],
            "format": self.tile_config["format"],
            "download_stats": self.stats,
            "tile_config": self.tile_config,
            "download_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "tiles_by_zoom": {},
            "total_downloaded_tiles": len(downloaded_tiles),
        }

        # Count tiles by zoom
        for tile in downloaded_tiles:
            zoom = tile["zoom"]
            if zoom not in metadata["tiles_by_zoom"]:
                metadata["tiles_by_zoom"][zoom] = 0
            metadata["tiles_by_zoom"][zoom] += 1

        # Save metadata
        metadata_path = self.output_dir / "metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        self.logger.info(f"Metadata saved to {metadata_path}")

        # Also save a simple tile index for frontend use
        self._save_tile_index(downloaded_tiles)

    def _save_tile_index(self, downloaded_tiles: List[Dict]) -> None:
        """Save a simple tile index optimized for frontend consumption."""
        # Group by zoom level
        index = {
            "base_path": str(self.output_dir),
            "format": self.tile_config["format"],
            "zoom_levels": {},
        }

        for tile in downloaded_tiles:
            zoom = str(tile["zoom"])
            if zoom not in index["zoom_levels"]:
                index["zoom_levels"][zoom] = {
                    "min_x": tile["x"],
                    "max_x": tile["x"],
                    "min_y": tile["y"],
                    "max_y": tile["y"],
                    "count": 0,
                }

            level = index["zoom_levels"][zoom]
            level["min_x"] = min(level["min_x"], tile["x"])
            level["max_x"] = max(level["max_x"], tile["x"])
            level["min_y"] = min(level["min_y"], tile["y"])
            level["max_y"] = max(level["max_y"], tile["y"])
            level["count"] += 1

        index_path = self.output_dir / "tile_index.json"
        with open(index_path, "w") as f:
            json.dump(index, f, indent=2)

        self.logger.info(f"Tile index saved to {index_path}")

    def _print_download_summary(self) -> None:
        """Print a summary of the download session."""
        print("\n" + "=" * 60)
        print("TILE DOWNLOAD SUMMARY")
        print("=" * 60)
        print(f"Total requests:      {self.stats['total_requests']}")
        print(f"Successful:          {self.stats['successful_downloads']}")
        print(f"Failed:              {self.stats['failed_downloads']}")
        print(f"Skipped (existing):  {self.stats['skipped_existing']}")
        print(
            f"Bytes downloaded:    {self.stats['bytes_downloaded'] / 1024 / 1024:.2f} MB"
        )
        print("-" * 60)

        # Show tiles per zoom level
        print("Tiles by zoom level:")
        for zoom_dir in sorted(self.output_dir.iterdir()):
            if zoom_dir.is_dir() and zoom_dir.name.startswith("zoom_"):
                count = len(list(zoom_dir.glob("*.*")))
                print(f"  {zoom_dir.name}: {count} tiles")

        print("=" * 60)

    # ============================================================
    # Legacy methods for compatibility with existing code
    # ============================================================

    async def download_tiles_from_patterns(
        self, tile_patterns: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Legacy method - redirects to RDR2 specific download.

        This method is kept for backward compatibility with main.py.
        """
        self.logger.info("Using RDR2-specific tile download (ignoring patterns)")
        return await self.download_rdr2_tiles()

    def validate_downloaded_tiles(self) -> Dict[str, Any]:
        """Validate downloaded tile files."""
        validation_results = {
            "total_files": 0,
            "valid_tiles": 0,
            "invalid_tiles": 0,
            "empty_files": 0,
            "corrupted_files": [],
            "total_size_bytes": 0,
        }

        for tile_file in self.output_dir.rglob("*.*"):
            if tile_file.is_file() and not tile_file.name.endswith(".json"):
                validation_results["total_files"] += 1

                try:
                    file_size = tile_file.stat().st_size
                    validation_results["total_size_bytes"] += file_size

                    if file_size == 0:
                        validation_results["empty_files"] += 1
                        validation_results["corrupted_files"].append(str(tile_file))
                    elif file_size < 100:
                        validation_results["invalid_tiles"] += 1
                        validation_results["corrupted_files"].append(str(tile_file))
                    else:
                        validation_results["valid_tiles"] += 1

                except Exception as e:
                    self.logger.warning(f"Error validating {tile_file}: {e}")
                    validation_results["invalid_tiles"] += 1
                    validation_results["corrupted_files"].append(str(tile_file))

        return validation_results

    def organize_tiles_by_zoom(self) -> Dict[int, List[Path]]:
        """Organize downloaded tiles by zoom level."""
        tiles_by_zoom = {}

        for zoom_dir in self.output_dir.iterdir():
            if zoom_dir.is_dir() and zoom_dir.name.startswith("zoom_"):
                try:
                    zoom_level = int(zoom_dir.name.split("_")[1])
                    tiles_by_zoom[zoom_level] = list(zoom_dir.glob("*.*"))
                except (ValueError, IndexError):
                    continue

        return tiles_by_zoom

    def get_download_stats(self) -> Dict[str, Any]:
        """Get current download statistics."""
        return self.stats.copy()


# Standalone execution for direct tile downloading
async def main():
    """Main function for standalone tile downloading."""
    import argparse

    parser = argparse.ArgumentParser(description="RDR2 Map Tile Downloader")
    parser.add_argument(
        "--output", "-o", default="data/tiles", help="Output directory for tiles"
    )
    parser.add_argument(
        "--zoom",
        "-z",
        type=int,
        nargs="+",
        help="Specific zoom levels to download (0-6)",
    )
    parser.add_argument(
        "--rate-limit",
        "-r",
        type=float,
        default=0.5,
        help="Rate limit in seconds between requests",
    )
    parser.add_argument(
        "--concurrent", "-c", type=int, default=5, help="Maximum concurrent downloads"
    )
    parser.add_argument(
        "--force", "-f", action="store_true", help="Force re-download of existing tiles"
    )

    args = parser.parse_args()

    # Setup logging
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
    )

    # Create downloader
    downloader = TileDownloader(
        output_dir=args.output,
        rate_limit=args.rate_limit,
        max_concurrent=args.concurrent,
    )

    # Download tiles
    await downloader.download_rdr2_tiles(
        zoom_levels=args.zoom, skip_existing=not args.force
    )


if __name__ == "__main__":
    asyncio.run(main())
