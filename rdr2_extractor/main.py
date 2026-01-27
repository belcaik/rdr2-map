#!/usr/bin/env python3
"""
RDR2 Map Data Extractor
Main orchestrator script for extracting data from rdr2map.com
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

# Import our modules
from src.browser_controller import BrowserController
from src.data_extractor import DataExtractor
from src.network_analyzer import NetworkAnalyzer
from src.tile_downloader import TileDownloader
from src.utils.config import Config
from src.utils.logger import setup_logging


class RDR2Extractor:
    def __init__(self, config: Config):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # Initialize components
        self.browser = BrowserController(
            headless=config.get("browser.headless", True),
            stealth_mode=config.get("browser.stealth_mode", True),
        )

        self.network_analyzer = NetworkAnalyzer(
            output_dir=config.get("output.network_logs", "data/network_logs")
        )

        self.data_extractor = DataExtractor(
            output_dir=config.get("output.window_data", "data/window_data")
        )

        self.tile_downloader = TileDownloader(
            output_dir=config.get("output.tiles", "data/tiles"),
            rate_limit=config.get("download.rate_limit", 2.0),
            max_concurrent=config.get("download.max_concurrent", 3),
        )

        # Session data
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_data = {
            "session_id": self.session_id,
            "start_time": datetime.now().isoformat(),
            "config": config.to_dict(),
            "phases_completed": [],
            "results": {},
        }

    async def run_full_extraction(self) -> Dict[str, Any]:
        """Run the complete extraction process"""
        self.logger.info("Starting RDR2 map data extraction")

        try:
            # Phase 1: Network Traffic Analysis
            await self._run_phase_1()

            # Phase 2: Data Extraction Analysis
            await self._run_phase_2()

            # Phase 3: Content Extraction
            await self._run_phase_3()

            # Generate final report
            final_report = self._generate_final_report()

            self.logger.info("Extraction completed successfully")
            return final_report

        except Exception as e:
            self.logger.error(f"Extraction failed: {e}")
            raise
        finally:
            # Cleanup
            self.browser.close()

    async def run_tiles_only(self) -> Dict[str, Any]:
        """Run only the tile download phase (Phase 3)"""
        self.logger.info("Starting RDR2 tile download (tiles-only mode)")

        try:
            # Only run Phase 3: Content Extraction
            await self._run_phase_3()

            # Generate simplified report
            final_report = self._generate_tiles_only_report()

            self.logger.info("Tile download completed successfully")
            return final_report

        except Exception as e:
            self.logger.error(f"Tile download failed: {e}")
            raise

    def _generate_tiles_only_report(self) -> Dict[str, Any]:
        """Generate report for tiles-only mode"""
        end_time = datetime.now()
        start_time = datetime.fromisoformat(self.session_data["start_time"])
        duration = (end_time - start_time).total_seconds()

        phase_3_results = self.session_data["results"].get("phase_3", {})
        download_stats = phase_3_results.get("download_stats", {})

        summary = {
            "session_id": self.session_id,
            "mode": "tiles_only",
            "duration_seconds": duration,
            "total_tiles_downloaded": download_stats.get("successful_downloads", 0),
            "failed_downloads": download_stats.get("failed_downloads", 0),
            "skipped_existing": download_stats.get("skipped_existing", 0),
            "bytes_downloaded": download_stats.get("bytes_downloaded", 0),
        }

        final_report = {
            "summary": summary,
            "session_data": self.session_data,
            "end_time": end_time.isoformat(),
        }

        # Save report
        report_file = f"data/tiles_report_{self.session_id}.json"
        Path(report_file).parent.mkdir(parents=True, exist_ok=True)
        with open(report_file, "w") as f:
            json.dump(final_report, f, indent=2, default=str)

        self.logger.info(f"Tiles report saved to {report_file}")

        # Print summary
        print("\n" + "=" * 60)
        print("RDR2 TILE DOWNLOAD SUMMARY")
        print("=" * 60)
        print(f"Session ID: {summary['session_id']}")
        print(f"Duration: {summary['duration_seconds']:.1f} seconds")
        print(f"Tiles Downloaded: {summary['total_tiles_downloaded']}")
        print(f"Failed: {summary['failed_downloads']}")
        print(f"Skipped (existing): {summary['skipped_existing']}")
        print(f"Data Downloaded: {summary['bytes_downloaded'] / 1024 / 1024:.2f} MB")
        print("=" * 60)

        return final_report

    async def _run_phase_1(self) -> None:
        """Phase 1: Network Traffic Analysis"""
        self.logger.info("=== PHASE 1: Network Traffic Analysis ===")

        target_url = self.config.get("target.url", "https://rdr2map.com")

        # Setup browser
        self.browser.setup_driver()

        # Navigate to site
        if not self.browser.navigate_to_site(target_url):
            raise Exception("Failed to navigate to target site")

        # Wait for dynamic content
        self.browser.wait_for_dynamic_content()

        # Interact with map to trigger network requests
        interactions = self.config.get(
            "browser.interactions", ["zoom_in", "zoom_out", "pan_left", "pan_right"]
        )
        self.browser.interact_with_map(interactions)

        # Capture final network logs
        network_logs = self.browser.capture_network_logs()

        # Analyze network traffic
        network_analysis = self.network_analyzer.analyze_network_logs(network_logs)

        # Identify tile patterns
        tile_patterns = self.network_analyzer.identify_tile_patterns(network_logs)

        # Extract API endpoints
        api_endpoints = self.network_analyzer.extract_api_endpoints(network_logs)

        # Save results
        network_file = self.network_analyzer.save_analysis(
            network_analysis, f"network_analysis_{self.session_id}.json"
        )

        # Save page source
        page_source_file = f"data/network_logs/page_source_{self.session_id}.html"
        self.browser.save_page_source(page_source_file)

        # Update session data
        self.session_data["phases_completed"].append("phase_1")
        self.session_data["results"]["phase_1"] = {
            "network_analysis_file": network_file,
            "page_source_file": page_source_file,
            "total_requests": len(network_logs),
            "api_endpoints_found": len(api_endpoints),
            "tile_patterns": tile_patterns,
            "unique_domains": len(network_analysis.get("unique_domains", [])),
        }

        self.logger.info(
            f"Phase 1 completed. Found {len(network_logs)} network requests"
        )

    async def _run_phase_2(self) -> None:
        """Phase 2: Data Extraction Analysis"""
        self.logger.info("=== PHASE 2: Data Extraction Analysis ===")

        # Extract window objects
        window_objects = self.browser.extract_window_objects()

        if not window_objects:
            self.logger.warning("No window objects extracted")
            return

        # Analyze extracted data
        try:
            extracted_data = self.data_extractor.extract_and_analyze_window_data(
                window_objects
            )
        except Exception as e:
            self.logger.error(f"Error in extract_and_analyze_window_data: {e}")
            import traceback

            self.logger.error(f"Traceback: {traceback.format_exc()}")
            raise

        # Save extracted data
        data_file = self.data_extractor.save_extracted_data(
            extracted_data, f"extracted_data_{self.session_id}.json"
        )

        # Update session data
        self.session_data["phases_completed"].append("phase_2")
        self.session_data["results"]["phase_2"] = {
            "extracted_data_file": data_file,
            "total_markers": len(extracted_data.get("markers", [])),
            "marker_categories": len(
                extracted_data.get("analysis_summary", {}).get("marker_categories", {})
            ),
            "tile_sources_found": len(extracted_data.get("tile_sources", [])),
            "window_objects_found": len(window_objects),
        }

        self.logger.info(
            f"Phase 2 completed. Extracted {len(extracted_data.get('markers', []))} markers"
        )

    async def _run_phase_3(self) -> None:
        """Phase 3: Content Extraction - Download tiles from mapgenie.io"""
        self.logger.info("=== PHASE 3: Content Extraction ===")

        # Get tile configuration
        zoom_levels = self.config.get("tiles.zoom_levels", [0, 1, 2, 3, 4, 5, 6])
        skip_existing = self.config.get("tiles.skip_existing", True)

        self.logger.info(f"Downloading tiles for zoom levels: {zoom_levels}")
        self.logger.info(f"Skip existing tiles: {skip_existing}")

        # Download tiles directly from mapgenie.io using known patterns
        download_stats = await self.tile_downloader.download_rdr2_tiles(
            zoom_levels=zoom_levels, skip_existing=skip_existing
        )

        # Validate downloaded tiles
        validation_results = self.tile_downloader.validate_downloaded_tiles()

        # Update session data
        self.session_data["phases_completed"].append("phase_3")
        self.session_data["results"]["phase_3"] = {
            "download_stats": download_stats,
            "validation_results": validation_results,
            "tiles_by_zoom": {
                str(k): len(v)
                for k, v in self.tile_downloader.organize_tiles_by_zoom().items()
            },
            "tile_source": "mapgenie.io",
            "zoom_levels_downloaded": zoom_levels,
        }

        self.logger.info(
            f"Phase 3 completed. Downloaded {download_stats.get('successful_downloads', 0)} tiles"
        )

    def _generate_final_report(self) -> Dict[str, Any]:
        """Generate comprehensive final report"""
        self.logger.info("Generating final extraction report")

        # Calculate session duration
        start_time = datetime.fromisoformat(self.session_data["start_time"])
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        # Compile summary statistics
        summary = {
            "session_id": self.session_id,
            "duration_seconds": duration,
            "phases_completed": self.session_data["phases_completed"],
            "total_network_requests": 0,
            "total_markers_extracted": 0,
            "total_tiles_downloaded": 0,
            "success_rate": 0.0,
        }

        # Extract key metrics from phases
        if "phase_1" in self.session_data["results"]:
            summary["total_network_requests"] = self.session_data["results"][
                "phase_1"
            ].get("total_requests", 0)

        if "phase_2" in self.session_data["results"]:
            summary["total_markers_extracted"] = self.session_data["results"][
                "phase_2"
            ].get("total_markers", 0)

        if "phase_3" in self.session_data["results"]:
            download_stats = self.session_data["results"]["phase_3"].get(
                "download_stats", {}
            )
            summary["total_tiles_downloaded"] = download_stats.get(
                "successful_downloads", 0
            )

        # Calculate success rate
        phases_attempted = 3
        phases_completed = len(self.session_data["phases_completed"])
        summary["success_rate"] = (phases_completed / phases_attempted) * 100

        # Create final report
        final_report = {
            "summary": summary,
            "session_data": self.session_data,
            "end_time": end_time.isoformat(),
            "recommendations": self._generate_recommendations(),
        }

        # Save final report
        report_file = f"data/final_report_{self.session_id}.json"
        Path(report_file).parent.mkdir(parents=True, exist_ok=True)
        with open(report_file, "w") as f:
            json.dump(final_report, f, indent=2, default=str)

        self.logger.info(f"Final report saved to {report_file}")

        # Print summary to console
        self._print_summary(summary)

        return final_report

    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on extraction results"""
        recommendations = []

        # Check phase completion
        if "phase_1" not in self.session_data["phases_completed"]:
            recommendations.append(
                "Phase 1 (Network Analysis) failed - check browser setup and target URL"
            )

        if "phase_2" not in self.session_data["phases_completed"]:
            recommendations.append(
                "Phase 2 (Data Extraction) failed - check window object extraction"
            )

        if "phase_3" not in self.session_data["phases_completed"]:
            recommendations.append(
                "Phase 3 (Content Download) failed - check tile patterns and network connectivity"
            )

        # Check data quality
        if "phase_2" in self.session_data["results"]:
            markers_count = self.session_data["results"]["phase_2"].get(
                "total_markers", 0
            )
            if markers_count == 0:
                recommendations.append(
                    "No markers extracted - may need to adjust data extraction patterns"
                )
            elif markers_count < 10:
                recommendations.append(
                    f"Low marker count ({markers_count}) - consider expanding extraction scope"
                )

        if "phase_3" in self.session_data["results"]:
            download_stats = self.session_data["results"]["phase_3"].get(
                "download_stats", {}
            )
            failed_downloads = download_stats.get("failed_downloads", 0)
            if failed_downloads > 0:
                recommendations.append(
                    f"{failed_downloads} tile downloads failed - consider adjusting rate limiting"
                )

        if not recommendations:
            recommendations.append(
                "Extraction completed successfully - proceed with React frontend development"
            )

        return recommendations

    def _print_summary(self, summary: Dict[str, Any]) -> None:
        """Print extraction summary to console"""
        print("\n" + "=" * 60)
        print("RDR2 MAP DATA EXTRACTION SUMMARY")
        print("=" * 60)
        print(f"Session ID: {summary['session_id']}")
        print(f"Duration: {summary['duration_seconds']:.1f} seconds")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        print(f"Phases Completed: {len(summary['phases_completed'])}/3")
        print()
        print("RESULTS:")
        print(f"  Network Requests Captured: {summary['total_network_requests']}")
        print(f"  Markers Extracted: {summary['total_markers_extracted']}")
        print(f"  Tiles Downloaded: {summary['total_tiles_downloaded']}")
        print()
        print("FILES GENERATED:")
        for phase, results in self.session_data["results"].items():
            print(f"  {phase.upper()}:")
            for key, value in results.items():
                if key.endswith("_file"):
                    print(f"    - {value}")
        print("=" * 60)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="RDR2 Map Data Extractor")
    parser.add_argument(
        "--config", "-c", default="config/default.json", help="Configuration file path"
    )
    parser.add_argument(
        "--headless", action="store_true", help="Run browser in headless mode"
    )
    parser.add_argument(
        "--no-stealth", action="store_true", help="Disable stealth mode"
    )
    parser.add_argument(
        "--max-tiles",
        type=int,
        default=5000,
        help="Maximum number of tiles to download",
    )
    parser.add_argument(
        "--rate-limit",
        type=float,
        default=0.5,
        help="Rate limit between requests (seconds)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level",
    )
    parser.add_argument(
        "--zoom-levels",
        type=int,
        nargs="+",
        default=None,
        help="Specific zoom levels to download (0-6)",
    )
    parser.add_argument(
        "--tiles-only",
        action="store_true",
        help="Skip phases 1 and 2, only download tiles",
    )
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Force re-download of existing tiles",
    )
    parser.add_argument(
        "--max-concurrent",
        type=int,
        default=5,
        help="Maximum concurrent tile downloads",
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(level=args.log_level)
    logger = logging.getLogger(__name__)

    try:
        # Load configuration
        config = Config(args.config)

        # Override config with command line arguments
        if args.headless:
            config.set("browser.headless", True)
        if args.no_stealth:
            config.set("browser.stealth_mode", False)
        config.set("download.max_tiles", args.max_tiles)
        config.set("download.rate_limit", args.rate_limit)
        config.set("download.max_concurrent", args.max_concurrent)

        # Tile-specific options
        if args.zoom_levels:
            config.set("tiles.zoom_levels", args.zoom_levels)
        if args.force_download:
            config.set("tiles.skip_existing", False)

        # Create and run extractor
        extractor = RDR2Extractor(config)

        # Run extraction (tiles-only mode or full)
        if args.tiles_only:
            logger.info("Running in tiles-only mode")
            final_report = asyncio.run(extractor.run_tiles_only())
        else:
            final_report = asyncio.run(extractor.run_full_extraction())

        logger.info("Extraction completed successfully")
        return 0

    except KeyboardInterrupt:
        logger.info("Extraction interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
