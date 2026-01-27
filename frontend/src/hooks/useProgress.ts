import { useState, useEffect, useCallback } from "react";
import {
  fetchProgress,
  toggleMarkerFound,
  resetProgress,
} from "../services/api";

export function useProgress() {
  const [foundMarkers, setFoundMarkers] = useState<Set<number>>(new Set());
  const [hideFound, setHideFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProgress()
      .then((progress) => {
        setFoundMarkers(new Set(progress.map((p) => p.marker_id)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleFound = useCallback(async (markerId: number) => {
    try {
      const result = await toggleMarkerFound(markerId);
      setFoundMarkers((prev) => {
        const next = new Set(prev);
        if (result.found) {
          next.add(markerId);
        } else {
          next.delete(markerId);
        }
        return next;
      });
      return result.found;
    } catch (err) {
      console.error("Failed to toggle marker:", err);
      throw err;
    }
  }, []);

  const isFound = useCallback(
    (markerId: number) => foundMarkers.has(markerId),
    [foundMarkers],
  );

  const toggleHideFound = useCallback(() => {
    setHideFound((prev) => !prev);
  }, []);

  const reset = useCallback(async () => {
    try {
      await resetProgress();
      setFoundMarkers(new Set());
    } catch (err) {
      console.error("Failed to reset progress:", err);
      throw err;
    }
  }, []);

  const foundCount = foundMarkers.size;

  return {
    foundMarkers,
    foundCount,
    hideFound,
    loading,
    error,
    toggleFound,
    isFound,
    toggleHideFound,
    reset,
  };
}
