import type { Category } from '../types';

interface CategoryMenuProps {
  categories: Category[];
  visibleCategories: Set<number>;
  foundMarkers: Set<number>;
  markers: { id: number; category_id: number }[];
  onToggleCategory: (categoryId: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoryMenu({
  categories,
  visibleCategories,
  foundMarkers,
  markers,
  onToggleCategory,
  onShowAll,
  onHideAll,
  isOpen,
  onClose,
}: CategoryMenuProps) {
  if (!isOpen) return null;

  // Calculate found count per category
  const categoryStats = categories.map((cat) => {
    const categoryMarkers = markers.filter((m) => m.category_id === cat.id);
    const found = categoryMarkers.filter((m) => foundMarkers.has(m.id)).length;
    return {
      ...cat,
      total: categoryMarkers.length,
      found,
    };
  });

  // Group categories by group_id
  const groupedCategories = categoryStats.reduce((acc, cat) => {
    const groupId = cat.group_id || 0;
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(cat);
    return acc;
  }, {} as Record<number, typeof categoryStats>);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '300px',
        height: '100%',
        background: 'rgba(26, 26, 46, 0.95)',
        zIndex: 1000,
        overflowY: 'auto',
        borderRight: '1px solid #333',
      }}
    >
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, color: 'white', fontSize: '16px' }}>Categories</h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
        <button
          onClick={onShowAll}
          style={{
            padding: '8px 12px',
            marginRight: '8px',
            background: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Show All
        </button>
        <button
          onClick={onHideAll}
          style={{
            padding: '8px 12px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Hide All
        </button>
      </div>

      <div style={{ padding: '8px' }}>
        {Object.entries(groupedCategories)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([groupId, cats]) => (
            <div key={groupId} style={{ marginBottom: '16px' }}>
              {cats
                .sort((a, b) => b.total - a.total)
                .map((cat) => (
                  <label
                    key={cat.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      background: visibleCategories.has(cat.id)
                        ? 'rgba(255,255,255,0.1)'
                        : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleCategories.has(cat.id)}
                      onChange={() => onToggleCategory(cat.id)}
                      style={{ marginRight: '8px' }}
                    />
                    <span
                      style={{
                        flex: 1,
                        color: 'white',
                        fontSize: '13px',
                      }}
                    >
                      {cat.title}
                    </span>
                    <span
                      style={{
                        color: cat.found === cat.total ? '#4ade80' : '#888',
                        fontSize: '12px',
                      }}
                    >
                      {cat.found}/{cat.total}
                    </span>
                  </label>
                ))}
            </div>
          ))}
      </div>
    </div>
  );
}
