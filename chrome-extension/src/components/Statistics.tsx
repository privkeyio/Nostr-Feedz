import { useState, useEffect } from 'react';
import type { ReadingStats } from '../types';
import { feedDatabase } from '../db/feedDatabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function Statistics({ isOpen, onClose }: Props) {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    feedDatabase.getReadingStats()
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load stats:', err);
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="stats-overlay" onClick={onClose}>
      <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stats-header">
          <h3>Reading Statistics</h3>
          <button className="stats-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading ? (
          <div className="stats-loading">Loading...</div>
        ) : stats ? (
          <div className="stats-content">
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{stats.totalRead}</span>
                <span className="stat-label">Total Read</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{stats.readToday}</span>
                <span className="stat-label">Read Today</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{stats.readThisWeek}</span>
                <span className="stat-label">This Week</span>
              </div>
            </div>

            {stats.topFeeds.length > 0 && (
              <div className="top-feeds">
                <h4>Top Feeds</h4>
                <ul>
                  {stats.topFeeds.map((feed) => (
                    <li key={feed.feedTitle}>
                      <span className="feed-name">{feed.feedTitle}</span>
                      <span className="feed-count">{feed.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
