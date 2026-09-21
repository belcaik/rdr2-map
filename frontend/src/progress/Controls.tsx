interface Props {
  hideFound: boolean;
  onToggleHideFound: () => void;
  onOpenCategories: () => void;
  foundCount: number;
  totalCount: number;
}
export default function Controls({ hideFound, onToggleHideFound, onOpenCategories, foundCount, totalCount }: Props) {
  return <div className="map-controls">
    <div className="progress-count" aria-label="Found progress" aria-live="polite"><strong>{foundCount} / {totalCount}</strong><span> found</span></div>
    <button onClick={onOpenCategories}>Categories</button>
    <button onClick={onToggleHideFound} aria-pressed={hideFound}>{hideFound ? 'Show Found' : 'Hide Found'}</button>
  </div>;
}
