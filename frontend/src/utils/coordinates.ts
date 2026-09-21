import L from "leaflet";

/**
 * Convert game coordinates to a Leaflet LatLng.
 *
 * The database stores Web Mercator lat/lng directly:
 *   coord_x = latitude  (north-south, range: -52 to 82)
 *   coord_y = longitude (east-west,   range: -164 to 135)
 *
 * With Leaflet's default CRS (EPSG3857) no projection math is needed —
 * the values are used as-is.
 */
export function gameToLeaflet(gameX: number, gameY: number): L.LatLng {
  return L.latLng(gameX, gameY);
}
