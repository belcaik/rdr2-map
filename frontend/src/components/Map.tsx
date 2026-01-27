import { useMemo } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Marker as MarkerType } from "../types";
import MapMarkers from "./MapMarkers";

// ============================================================
// Tile Configuration
// ============================================================
const TILE_SIZE = 256;
const MAX_ZOOM = 6;
const MIN_ZOOM = 0;

// ============================================================
// Coordinate System Alignment
// ============================================================
// The marker transformation (in MapMarkers.tsx) produces these ranges:
// - Markers lng: -105.4 to 219.8 (width: 325.1)
// - Markers lat: -224.3 to -21.6 (height: 202.6)
//
// The tiles must be positioned to cover this EXACT range.
// This way, markers and tiles use the SAME coordinate space.

// Tile bounds matching the marker coordinate ranges
// (calculated from marker transformation in MapMarkers.tsx)
const TILE_BOUNDS = {
  west: -105.4, // Leftmost marker lng
  east: 219.8, // Rightmost marker lng
  south: -224.3, // Bottommost marker lat (most negative)
  north: -21.6, // Topmost marker lat (least negative)
};

// Leaflet bounds object
const bounds = new L.LatLngBounds(
  L.latLng(TILE_BOUNDS.south, TILE_BOUNDS.west), // Southwest corner
  L.latLng(TILE_BOUNDS.north, TILE_BOUNDS.east), // Northeast corner
);

// Map center
const center = L.latLng(
  (TILE_BOUNDS.south + TILE_BOUNDS.north) / 2,
  (TILE_BOUNDS.west + TILE_BOUNDS.east) / 2,
);

// ============================================================
// Map Component
// ============================================================
interface MapProps {
  markers: MarkerType[];
  visibleCategories: Set<number>;
  foundMarkers: Set<number>;
  hideFound: boolean;
  onMarkerClick: (marker: MarkerType) => void;
  onToggleFound: (markerId: number) => void;
}

export default function Map({
  markers,
  visibleCategories,
  foundMarkers,
  hideFound,
  onMarkerClick,
  onToggleFound,
}: MapProps) {
  const visibleMarkers = useMemo(() => {
    return markers.filter((marker) => {
      if (!visibleCategories.has(marker.category_id)) return false;
      if (hideFound && foundMarkers.has(marker.id)) return false;
      return true;
    });
  }, [markers, visibleCategories, foundMarkers, hideFound]);

  return (
    <MapContainer
      crs={L.CRS.Simple}
      center={center}
      zoom={1}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      maxBounds={bounds.pad(0.1)}
      maxBoundsViscosity={1.0}
      style={{ height: "100%", width: "100%", background: "#1a1a2e" }}
      zoomControl={true}
    >
      <TileLayer
        url="http://localhost:3001/api/tiles/{z}/{x}/{y}.jpg"
        tileSize={TILE_SIZE}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        noWrap={true}
        bounds={bounds}
      />
      <MapMarkers
        markers={visibleMarkers}
        foundMarkers={foundMarkers}
        onMarkerClick={onMarkerClick}
        onToggleFound={onToggleFound}
      />
    </MapContainer>
  );
}
