interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '16px', className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function ItemSkeleton() {
  return (
    <div className="item-row skeleton-row" aria-hidden="true">
      <Skeleton width="16px" height="16px" className="skeleton-icon" />
      <div className="item-content">
        <Skeleton height="14px" className="skeleton-title" />
        <div className="item-meta" style={{ marginTop: '6px' }}>
          <Skeleton width="80px" height="11px" />
          <Skeleton width="32px" height="11px" />
        </div>
      </div>
    </div>
  );
}
