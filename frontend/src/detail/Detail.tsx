import { useEffect, useRef, useState } from 'react';
import type { MarkerDetail } from '../types';
import { fetchMarker } from '../services/api';
import CategoryIcon from '../categories/CategoryIcon';
import Description from './Description';
import Gallery from './Gallery';

export default function Detail({ id, found, onToggle, onClose }: { id: number; found: boolean; onToggle: () => Promise<void>; onClose: () => void }) {
  const [point, setPoint] = useState<MarkerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    return () => {
      if (previous instanceof HTMLElement && previous !== document.body && previous !== document.documentElement && previous.isConnected) previous.focus();
      else document.getElementById('waypoint-search')?.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetchMarker(id, controller.signal).then(setPoint).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [id]);
  useEffect(() => { if (point) heading.current?.focus(); }, [point]);
  return <aside className="waypoint-detail" aria-label="Waypoint details" onKeyDown={event => {
    if (event.key === 'Escape' && !(event.target as HTMLElement).closest('dialog')) { event.stopPropagation(); onClose(); }
  }}>
    <button className="detail-close" aria-label="Close waypoint details" onClick={onClose}>Close</button>
    {error && <p role="alert">{error}</p>}
    {!point && !error && <p role="status">Loading waypoint…</p>}
    {point && <>
      <div className="detail-category"><CategoryIcon key={point.category_icon_asset?.id} asset={point.category_icon_asset} name={point.category_title} reason={point.icon_reason} /><span>{point.category_title}</span></div>
      <h2 ref={heading} tabIndex={-1}>{point.name}</h2>
      <button className={found ? 'found-button is-found' : 'found-button'} disabled={saving} onClick={async () => {
        setSaving(true); setError(null);
        try { await onToggle(); } catch (error) { setError(error instanceof Error ? error.message : 'Could not save progress'); }
        finally { setSaving(false); }
      }}>{found ? 'Mark as not found' : 'Mark as found'}</button>
      <Description text={point.description} format={point.description_format} />
      {point.image_discovery === 'present' ? <Gallery key={point.id} images={point.images} /> : <p className="media-status" role="status">{
        point.image_discovery === 'none' ? 'No photographs in the inspected source.' : point.image_discovery === 'failed' ? `Photograph inspection failed. ${point.discovery_error ?? ''}` : 'Photographs have not been inspected yet.'
      }</p>}
      {/^https:\/\//.test(point.source_url) && <a className="source-link" href={point.source_url} target="_blank" rel="noreferrer">View source waypoint</a>}
    </>}
  </aside>;
}
