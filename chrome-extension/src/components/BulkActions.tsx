interface Props {
  selectedCount: number;
  onMarkRead: () => void;
  onClearSelection: () => void;
}

export function BulkActions({ selectedCount, onMarkRead, onClearSelection }: Props) {
  return (
    <div className="bulk-actions bulk-actions-active">
      <span className="bulk-count">{selectedCount} selected</span>
      <button className="bulk-btn bulk-btn-primary" onClick={onMarkRead}>
        Mark Read
      </button>
      <button className="bulk-btn" onClick={onClearSelection}>
        Clear
      </button>
    </div>
  );
}
