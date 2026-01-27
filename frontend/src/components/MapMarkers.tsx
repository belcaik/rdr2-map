import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Marker as MarkerType } from "../types";

// ============================================================
// Coordinate Transformation
// ============================================================
// Transform game coordinates to Leaflet pixel coordinates
//
// Game coordinate system (from database):
// - coord_x (latitude): -52.36 to 82.05 (south to north)
// - coord_y (longitude): -163.90 to 134.76 (west to east)
//
// Leaflet CRS.Simple coordinate system:
// - lng: 0 to 256 (left to right)
// - lat: 0 to -188 (top to bottom, Y is inverted)
//
// Linear transformation derived from reference points:
// - Valentine Hotel (63.44, 20.22) → 37% from left, 26% from top
// - Van Horn Hotel (60.67, 116.94) → 78% from left, 29% from top
// - Strawberry Hotel (44.15, -23.38) → 19% from left, 42% from top

// Transform coefficients (calculated via least squares)
const LNG_SCALE = 1.088678;
const LNG_OFFSET = 73.0567;
const LAT_SCALE = 1.507601;
const LAT_OFFSET = -145.343;

/**
 * Transform game coordinates to Leaflet coordinates
 * @param gameX - coord_x from database (latitude, north-south)
 * @param gameY - coord_y from database (longitude, east-west)
 * @returns Leaflet LatLng position
 */
function gameToLeaflet(gameX: number, gameY: number): L.LatLng {
  const lng = LNG_SCALE * gameY + LNG_OFFSET;
  const lat = LAT_SCALE * gameX + LAT_OFFSET;
  return L.latLng(lat, lng);
}

// Create a simple colored circle marker
function createMarkerIcon(found: boolean): L.DivIcon {
  const color = found ? "#4ade80" : "#f59e0b";
  const borderColor = found ? "#166534" : "#92400e";

  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 12px;
      height: 12px;
      background: ${color};
      border: 2px solid ${borderColor};
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

interface MapMarkersProps {
  markers: MarkerType[];
  foundMarkers: Set<number>;
  onMarkerClick: (marker: MarkerType) => void;
  onToggleFound: (markerId: number) => void;
}

export default function MapMarkers({
  markers,
  foundMarkers,
  onMarkerClick,
  onToggleFound,
}: MapMarkersProps) {
  return (
    <>
      {markers.map((marker) => {
        const isFound = foundMarkers.has(marker.id);
        const position = gameToLeaflet(marker.coord_x, marker.coord_y);

        return (
          <Marker
            key={marker.id}
            position={position}
            icon={createMarkerIcon(isFound)}
            eventHandlers={{
              click: () => onMarkerClick(marker),
            }}
          >
            <Popup>
              <div style={{ minWidth: "200px" }}>
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  {marker.name}
                </h3>
                <p
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  {marker.category_title}
                </p>
                {marker.description && (
                  <p style={{ margin: "8px 0", fontSize: "12px" }}>
                    {marker.description}
                  </p>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFound(marker.id);
                  }}
                  style={{
                    marginTop: "8px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    cursor: "pointer",
                    background: isFound ? "#ef4444" : "#22c55e",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    width: "100%",
                  }}
                >
                  {isFound ? "Mark as Not Found" : "Mark as Found"}
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
