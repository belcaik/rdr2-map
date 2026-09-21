import { gameToLeaflet } from "./coordinates";

/**
 * Reference markers with coordinates verified against rdr2map.com GeoJSON data.
 *
 * The game database stores coordinates as Web Mercator lat/lng:
 *   coord_x = latitude  (north-south)
 *   coord_y = longitude (east-west)
 *
 * These were extracted from rdr2map.com's Mapbox GL locations-data source
 * on 2026-02-21 and cross-checked against the local SQLite database.
 *
 * With Leaflet EPSG3857 (default CRS), no transformation is needed —
 * L.latLng(coord_x, coord_y) places markers at the correct tile position.
 */
export const REFERENCE_MARKERS = [
  {
    name: "Valentine Hotel",
    game: { x: 63.44308869920492, y: 20.22273178853698 },
    leaflet: { lat: 63.44308869920492, lng: 20.22273178853698 },
    tolerance: 0, // No transformation — coordinates are identical
  },
  {
    name: "Blackwater (Landmark)",
    game: { x: 21.608918889712, y: 5.5336761474606 },
    leaflet: { lat: 21.608918889712, lng: 5.5336761474606 },
    tolerance: 0,
  },
  {
    name: "Saint Denis (Landmark)",
    game: { x: 19.099610666803, y: 110.58709473844 },
    leaflet: { lat: 19.099610666803, lng: 110.58709473844 },
    tolerance: 0,
  },
  {
    name: "Strawberry (Fast Travel)",
    game: { x: 42.597329926715, y: -23.774491722015 },
    leaflet: { lat: 42.597329926715, lng: -23.774491722015 },
    tolerance: 0,
  },
  {
    name: "Annesburg (Landmark)",
    game: { x: 70.288566343882, y: 113.04391214923 },
    leaflet: { lat: 70.288566343882, lng: 113.04391214923 },
    tolerance: 0,
  },
] as const;

/**
 * Additional reference markers from other categories for broader coverage.
 */
export const EXTENDED_REFERENCE_MARKERS = [
  {
    name: "Valentine (Landmark)",
    game: { x: 61.588878975177, y: 24.549587937611 },
    leaflet: { lat: 61.588878975177, lng: 24.549587937611 },
  },
  {
    name: "Valentine (Fast Travel)",
    game: { x: 63.586453512317, y: 20.842437744139 },
    leaflet: { lat: 63.586453512317, lng: 20.842437744139 },
  },
  {
    name: "Blackwater (Fast Travel)",
    game: { x: 20.55744305892798, y: 5.32233982662365 },
    leaflet: { lat: 20.55744305892798, lng: 5.32233982662365 },
  },
  {
    name: "Saint Denis (Fast Travel)",
    game: { x: 18.63106181253946, y: 108.95002386289912 },
    leaflet: { lat: 18.63106181253946, lng: 108.95002386289912 },
  },
  {
    name: "Annesburg (Fast Travel)",
    game: { x: 69.42458077685377, y: 115.31195626398164 },
    leaflet: { lat: 69.42458077685377, lng: 115.31195626398164 },
  },
] as const;

/**
 * Validate that the coordinate mapping produces correct Leaflet positions.
 * With EPSG3857, the mapping is identity (no transformation), so this
 * validates that coordinates are passed through unchanged.
 *
 * Returns true if all markers pass validation.
 */
export function validateTransformation(): boolean {
  let allPassed = true;

  for (const ref of REFERENCE_MARKERS) {
    const result = gameToLeaflet(ref.game.x, ref.game.y);
    const latDiff = Math.abs(result.lat - ref.leaflet.lat);
    const lngDiff = Math.abs(result.lng - ref.leaflet.lng);
    const passed = latDiff <= ref.tolerance && lngDiff <= ref.tolerance;

    if (!passed) {
      console.error(
        `FAIL: ${ref.name} — expected (${ref.leaflet.lat}, ${ref.leaflet.lng}), ` +
          `got (${result.lat}, ${result.lng}), diff=(${latDiff}, ${lngDiff})`,
      );
      allPassed = false;
    } else {
      console.log(`PASS: ${ref.name} — (${result.lat}, ${result.lng})`);
    }
  }

  return allPassed;
}

/**
 * Verify that a game coordinate maps to the expected Web Mercator tile
 * at zoom level 6. This catches issues with tile numbering or CRS mismatch.
 */
export function verifyTileMapping(
  gameX: number,
  gameY: number,
): { tileX: number; tileY: number } {
  const n = Math.pow(2, 6); // zoom 6
  const tileX = Math.floor((n * (gameY + 180)) / 360);
  const latRad = (gameX * Math.PI) / 180;
  const tileY = Math.floor(
    (n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) /
      2,
  );
  return { tileX, tileY };
}
