interface ControlsProps {
  hideFound: boolean;
  onToggleHideFound: () => void;
  onOpenCategories: () => void;
  foundCount: number;
  totalCount: number;
}

export default function Controls({
  hideFound,
  onToggleHideFound,
  onOpenCategories,
  foundCount,
  totalCount,
}: ControlsProps) {
  const percentage = totalCount > 0 ? ((foundCount / totalCount) * 100).toFixed(1) : '0';

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Progress indicator */}
      <div
        style={{
          background: 'rgba(26, 26, 46, 0.95)',
          padding: '12px 16px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Progress</div>
        <div style={{ fontSize: '20px', color: '#4ade80' }}>
          {foundCount} / {totalCount}
        </div>
        <div style={{ fontSize: '12px', color: '#888' }}>{percentage}%</div>
      </div>

      {/* Categories button */}
      <button
        onClick={onOpenCategories}
        style={{
          padding: '12px 16px',
          background: 'rgba(26, 26, 46, 0.95)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>☰</span>
        Categories
      </button>

      {/* Hide found toggle */}
      <button
        onClick={onToggleHideFound}
        style={{
          padding: '12px 16px',
          background: hideFound ? '#22c55e' : 'rgba(26, 26, 46, 0.95)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        {hideFound ? '👁 Show Found' : '👁‍🗨 Hide Found'}
      </button>
    </div>
  );
}
