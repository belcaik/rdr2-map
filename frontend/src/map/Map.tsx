import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Marker } from '../types';
import CanvasMarkers from './CanvasMarkers';
import { API_BASE } from '../services/api';
import { gameToLeaflet } from '../utils/coordinates';

const tileSource = import.meta.env.VITE_TILE_SOURCE ?? 'local';
const bounds = new L.LatLngBounds([-70, -180], [85, 180]);
function SelectedPoint({ point }: { point: Marker | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.panTo(gameToLeaflet(point.coord_x, point.coord_y), { animate: false });
  }, [map, point]);
  return null;
}

interface Props {
  markers: Marker[];
  visibleCategories: Set<number>;
  foundMarkers: Set<number>;
  hideFound: boolean;
  selected: Marker | null;
  onMarkerClick: (marker: Marker) => void;
}
export default function Map({ markers, visibleCategories, foundMarkers, hideFound, selected, onMarkerClick }: Props) {
  const visible = useMemo(() => markers.filter(point => visibleCategories.has(point.category_id) && !(hideFound && foundMarkers.has(point.id))), [markers, visibleCategories, foundMarkers, hideFound]);
  return <MapContainer center={[30, 45]} zoom={3} minZoom={2} maxZoom={6} maxBounds={bounds} maxBoundsViscosity={1} style={{ height: '100%', width: '100%' }}>
    {tileSource === 'local' && <TileLayer url={`${API_BASE}/tiles/{z}/{x}/{y}.jpg`} tileSize={256} minZoom={2} maxZoom={6} noWrap />}
    <SelectedPoint point={selected} />
    <CanvasMarkers markers={visible} foundMarkers={foundMarkers} selectedId={selected?.id ?? null} onMarkerClick={onMarkerClick} />
  </MapContainer>;
}
