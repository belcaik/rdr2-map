import { useEffect, useRef, useState } from 'react';
import type { MarkerDetail } from '../types';
import { assetUrl } from '../services/api';

function Photograph({ image }: { image: MarkerDetail['images'][number] }) {
  const [failed, setFailed] = useState(false);
  if (image.status === 'pending') return <p role="status">Photograph download pending.</p>;
  if (image.status === 'failed') return <p role="status">Photograph download failed. {image.error}</p>;
  if (failed) return <p role="status">Local photograph file unavailable. Re-run media enrichment to restore it.</p>;
  return <img src={assetUrl(image.id)} alt={image.caption || 'Waypoint reference photograph'} loading="lazy" onError={() => setFailed(true)} />;
}

export default function Gallery({ images }: { images: MarkerDetail['images'] }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const image = images[index];
  const step = (offset: number) => setIndex(current => (current + offset + images.length) % images.length);

  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);

  if (!image) return null;
  const navigation = <div className="gallery-navigation">
    <button onClick={() => step(-1)} disabled={images.length < 2} aria-label="Previous photograph">Previous</button>
    <span aria-live="polite">{index + 1} / {images.length}</span>
    <button onClick={() => step(1)} disabled={images.length < 2} aria-label="Next photograph">Next</button>
  </div>;
  const picture = <figure>
    <Photograph key={image.id} image={image} />
    {(image.caption || image.attribution) && <figcaption>{image.caption}{image.attribution && <small>{image.attribution}</small>}</figcaption>}
  </figure>;
  return <div className="gallery" onKeyDown={event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); step(event.key === 'ArrowRight' ? 1 : -1); }
  }} onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => {
    const end = event.changedTouches[0]?.clientX;
    if (touchStart.current !== null && end !== undefined && Math.abs(end - touchStart.current) > 45) step(end < touchStart.current ? 1 : -1);
    touchStart.current = null;
  }}>
    {picture}
    {navigation}
    <button onClick={() => setExpanded(true)} disabled={image.status !== 'downloaded'} aria-label="Enlarge photograph">Enlarge photograph</button>
    <dialog ref={dialog} className="gallery-dialog" aria-label="Reference photographs" onCancel={() => setExpanded(false)} onClose={() => setExpanded(false)}>
      <button className="gallery-close" aria-label="Close gallery" onClick={() => setExpanded(false)}>Close gallery</button>
      {expanded && picture}
      {navigation}
    </dialog>
  </div>;
}
