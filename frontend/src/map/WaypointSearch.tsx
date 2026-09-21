import { useMemo, useState } from 'react';
import type { Marker } from '../types';

export default function WaypointSearch({ markers, visibleCategories, foundMarkers, hideFound, onSelect }: { markers: Marker[]; visibleCategories: Set<number>; foundMarkers: Set<number>; hideFound: boolean; onSelect: (marker: Marker) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => markers.filter(point => visibleCategories.has(point.category_id) && !(hideFound && foundMarkers.has(point.id)) && point.name.toLowerCase().includes(query.toLowerCase())).slice(0, 30), [markers, visibleCategories, foundMarkers, hideFound, query]);
  return <div className="waypoint-search">
    <label htmlFor="waypoint-search">RDR2 Map</label>
    <input id="waypoint-search" type="search" placeholder="Search waypoints" value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); } }} aria-expanded={open} aria-controls="waypoint-results" />
    {open && <div id="waypoint-results" className="search-results">
      <button className="search-close" onClick={() => setOpen(false)}>Close results</button>
      {results.map(point => <button key={point.id} aria-label={point.name} onClick={() => { onSelect(point); setOpen(false); }}>{point.name}<small>{point.category_title} · {point.id}</small></button>)}
      {!results.length && <p>No matching visible waypoints.</p>}
      {results.length === 30 && <small>First 30 matches. Refine your search.</small>}
    </div>}
  </div>;
}
