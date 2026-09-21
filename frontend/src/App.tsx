import { useState, useCallback } from "react";
import Map from "./map/Map";
import CategoryMenu from "./categories/CategoryMenu";
import Controls from "./progress/Controls";
import Detail from "./detail/Detail";
import WaypointSearch from "./map/WaypointSearch";
import { useMarkers } from "./hooks/useMarkers";
import { useCategories } from "./hooks/useCategories";
import { useProgress } from "./hooks/useProgress";
import { useDebounce } from "./hooks/useDebounce";
import type { Marker } from "./types";
import "./App.css";

function App() {
  const {
    markers,
    loading: markersLoading,
    error: markersError,
  } = useMarkers();
  const {
    categories,
    visibleCategories,
    loading: categoriesLoading,
    error: categoriesError,
    toggleCategory,
    showAllCategories,
    hideAllCategories,
  } = useCategories();
  const {
    foundMarkers,
    foundCount,
    hideFound,
    loading: progressLoading,
    error: progressError,
    toggleFound,
    toggleHideFound,
  } = useProgress();

  const debouncedVisibleCategories = useDebounce(visibleCategories, 150);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Marker | null>(null);

  const handleMarkerClick = useCallback((marker: Marker) => {
    setSelected(marker);
  }, []);

  const handleToggleFound = useCallback(
    async (markerId: number) => {
      await toggleFound(markerId);
    },
    [toggleFound],
  );

  const isLoading = markersLoading || categoriesLoading || progressLoading;
  const error = markersError || categoriesError || progressError;

  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading map data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h2>Error loading map</h2>
        <p>{error}</p>
        <p>Check that the local API is running, then reload.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Map
        markers={markers}
        visibleCategories={debouncedVisibleCategories}
        foundMarkers={foundMarkers}
        hideFound={hideFound}
        onMarkerClick={handleMarkerClick}
        selected={selected}
      />
      <WaypointSearch markers={markers} visibleCategories={visibleCategories} foundMarkers={foundMarkers} hideFound={hideFound} onSelect={handleMarkerClick} />
      <Controls
        hideFound={hideFound}
        onToggleHideFound={toggleHideFound}
        onOpenCategories={() => setMenuOpen(true)}
        foundCount={foundCount}
        totalCount={markers.length}
      />
      <CategoryMenu
        categories={categories}
        visibleCategories={visibleCategories}
        foundMarkers={foundMarkers}
        markers={markers}
        onToggleCategory={toggleCategory}
        onShowAll={showAllCategories}
        onHideAll={hideAllCategories}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      {selected && <Detail key={selected.id} id={selected.id} found={foundMarkers.has(selected.id)} onToggle={() => handleToggleFound(selected.id)} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default App;
