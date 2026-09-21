import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { gameToLeaflet } from '../utils/coordinates';
import { assetUrl } from '../services/api';
import type { Marker } from '../types';

interface Props {
  markers: Marker[];
  foundMarkers: Set<number>;
  selectedId: number | null;
  onMarkerClick: (marker: Marker) => void;
}

// Keep the existing single-canvas, viewport-filtered rendering approach. Decoded
// category symbols are shared by every waypoint and survive pan/progress updates.
export default function CanvasMarkers({ markers, foundMarkers, selectedId, onMarkerClick }: Props) {
  const map = useMap();
  const images = useRef(new Map<string, HTMLImageElement>());
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'waypoint-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    map.getPanes().overlayPane.appendChild(canvas);
    const context = canvas.getContext('2d');
    let frame = 0;
    let disposed = false;
    let visible: { point: Marker; position: L.Point }[] = [];
    function draw() {
      frame = 0;
      if (!context || disposed) return;
      const size = map.getSize();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = size.x * ratio;
      canvas.height = size.y * ratio;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      context.scale(ratio, ratio);
      visible = [];
      const bounds = map.getBounds().pad(0.05);
      for (const point of markers) {
        const latLng = gameToLeaflet(point.coord_x, point.coord_y);
        if (!bounds.contains(latLng)) continue;
        const position = map.latLngToContainerPoint(latLng);
        visible.push({ point, position });
        const found = foundMarkers.has(point.id);
        const selected = point.id === selectedId;
        context.globalAlpha = found ? 0.65 : 1;
        context.beginPath();
        context.arc(position.x, position.y, selected ? 19 : 16, 0, Math.PI * 2);
        context.fillStyle = '#251c16';
        context.fill();
        context.strokeStyle = found ? '#82d89a' : selected ? '#fff3ce' : '#cfa975';
        context.lineWidth = selected || found ? 3 : 1;
        context.stroke();
        const asset = point.category_icon_asset;
        let image: HTMLImageElement | undefined;
        if (asset?.status === 'downloaded') {
          image = images.current.get(asset.id);
          if (!image) {
            image = new Image();
            image.crossOrigin = 'anonymous';
            images.current.set(asset.id, image);
            image.src = assetUrl(asset.id);
          }
          image.onload = redraw;
        }
        if (image?.complete && image.naturalWidth) {
          const scale = Math.min(26 / image.naturalWidth, 30 / image.naturalHeight);
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          context.drawImage(image, position.x - width / 2, position.y - height / 2, width, height);
        } else {
          context.fillStyle = '#fff3ce';
          context.font = 'bold 16px sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText('?', position.x, position.y);
        }
        context.globalAlpha = 1;
      }
    }
    function redraw() { if (!disposed && !frame) frame = requestAnimationFrame(draw); }
    function select(event: L.LeafletMouseEvent) {
      let closest: Marker | undefined;
      let distance = 22;
      for (const { point, position } of visible) {
        const candidate = position.distanceTo(event.containerPoint);
        if (candidate < distance) { distance = candidate; closest = point; }
      }
      if (closest) onMarkerClick(closest);
    }
    map.on('move zoom resize', redraw);
    map.on('click', select);
    redraw();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      map.off('move zoom resize', redraw);
      map.off('click', select);
      canvas.remove();
    };
  }, [map, markers, foundMarkers, selectedId, onMarkerClick]);
  return null;
}
