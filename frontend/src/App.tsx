import { useState, useCallback } from "react";
import Map from "./components/Map";
import CategoryMenu from "./components/CategoryMenu";
import Controls from "./components/Controls";
import { useMarkers } from "./hooks/useMarkers";
import { useCategories } from "./hooks/useCategories";
import { useProgress } from "./hooks/useProgress";
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
    toggleCategory,
    showAllCategories,
    hideAllCategories,
  } = useCategories();
  const {
    foundMarkers,
    foundCount,
    hideFound,
    loading: progressLoading,
    toggleFound,
    toggleHideFound,
  } = useProgress();

  const [menuOpen, setMenuOpen] = useState(false);

  const handleMarkerClick = useCallback((_marker: Marker) => {
    // Marker click handling - popup is shown by Leaflet
  }, []);

  const handleToggleFound = useCallback(
    async (markerId: number) => {
      await toggleFound(markerId);
    },
    [toggleFound],
  );

  const isLoading = markersLoading || categoriesLoading || progressLoading;
  const error = markersError;

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
        <p>Make sure the backend server is running on port 3001</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Map
        markers={markers}
        visibleCategories={visibleCategories}
        foundMarkers={foundMarkers}
        hideFound={hideFound}
        onMarkerClick={handleMarkerClick}
        onToggleFound={handleToggleFound}
      />
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
    </div>
  );
}

export default App;
