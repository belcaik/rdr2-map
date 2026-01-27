import { useState, useEffect } from 'react';
import type { Marker } from '../types';
import { fetchMarkers } from '../services/api';

export function useMarkers() {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarkers()
      .then(setMarkers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { markers, loading, error };
}
