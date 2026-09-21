import { useEffect, useMemo, useRef } from 'react';
import type { Category } from '../types';
import CategoryIcon from './CategoryIcon';

interface Props {
  categories: Category[];
  visibleCategories: Set<number>;
  foundMarkers: Set<number>;
  markers: { id: number; category_id: number }[];
  onToggleCategory: (id: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  isOpen: boolean;
  onClose: () => void;
}
export default function CategoryMenu({ categories, visibleCategories, foundMarkers, markers, onToggleCategory, onShowAll, onHideAll, isOpen, onClose }: Props) {
  const close = useRef<HTMLButtonElement>(null);
  const counts = useMemo(() => {
    const result = new Map<number, { total: number; found: number }>();
    for (const marker of markers) {
      const count = result.get(marker.category_id) ?? { total: 0, found: 0 };
      count.total++;
      if (foundMarkers.has(marker.id)) count.found++;
      result.set(marker.category_id, count);
    }
    return result;
  }, [markers, foundMarkers]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    close.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return <aside className="category-menu" aria-label="Categories" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <header><h2>Categories</h2><button ref={close} onClick={onClose} aria-label="Close categories">Close</button></header>
    <div className="category-actions"><button onClick={onShowAll}>Show All</button><button onClick={onHideAll}>Hide All</button></div>
    {categories.map(category => {
      const count = counts.get(category.id) ?? { total: 0, found: 0 };
      return <label className="category-row" key={category.id}>
        <input type="checkbox" checked={visibleCategories.has(category.id)} onChange={() => onToggleCategory(category.id)} />
        <CategoryIcon asset={category.icon_asset} name={category.title} reason={category.icon_reason} />
        <span>{category.title}</span><small>{count.found}/{count.total}</small>
      </label>;
    })}
  </aside>;
}
