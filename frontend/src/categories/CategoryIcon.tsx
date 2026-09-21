import { useState } from 'react';
import type { Asset } from '../types';
import { assetUrl } from '../services/api';

export default function CategoryIcon({ asset, name, reason }: { asset: Asset | null; name: string; reason?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (asset?.status === 'downloaded' && !failed) {
    return <img className="category-symbol" src={assetUrl(asset.id)} alt={`${name} symbol`} onError={() => setFailed(true)} />;
  }
  const message = failed ? 'Local icon file unavailable' : reason || asset?.error || 'Category icon not downloaded';
  return <span className="category-symbol symbol-fallback" role="img" aria-label={`${name}: ${message}`} title={message}>?</span>;
}
