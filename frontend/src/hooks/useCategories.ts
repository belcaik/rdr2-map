import { useState, useEffect, useCallback } from 'react';
import type { Category } from '../types';
import { fetchCategories } from '../services/api';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [visibleCategories, setVisibleCategories] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats);
        // Initially show all categories
        setVisibleCategories(new Set(cats.map((c) => c.id)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleCategory = useCallback((categoryId: number) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const showAllCategories = useCallback(() => {
    setVisibleCategories(new Set(categories.map((c) => c.id)));
  }, [categories]);

  const hideAllCategories = useCallback(() => {
    setVisibleCategories(new Set());
  }, []);

  const isCategoryVisible = useCallback(
    (categoryId: number) => visibleCategories.has(categoryId),
    [visibleCategories]
  );

  return {
    categories,
    visibleCategories,
    loading,
    error,
    toggleCategory,
    showAllCategories,
    hideAllCategories,
    isCategoryVisible,
  };
}
