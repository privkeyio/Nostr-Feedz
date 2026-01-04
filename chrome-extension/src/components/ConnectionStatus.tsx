import { useState, useEffect } from 'react';

type Status = 'online' | 'offline' | 'syncing' | 'error';

interface Props {
  isSyncing: boolean;
  hasError: boolean;
}

export function ConnectionStatus({ isSyncing, hasError }: Props) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const status: Status = !isOnline ? 'offline' : isSyncing ? 'syncing' : hasError ? 'error' : 'online';

  const statusConfig = {
    online: { icon: '●', color: '#10b981', label: 'Connected' },
    offline: { icon: '○', color: '#6b7280', label: 'Offline' },
    syncing: { icon: '↻', color: '#6366f1', label: 'Syncing...' },
    error: { icon: '!', color: '#ef4444', label: 'Error' },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`connection-status ${status === 'syncing' ? 'syncing' : ''}`}
      style={{ color: config.color }}
      role="status"
      aria-live="polite"
      aria-label={config.label}
      title={config.label}
    >
      {config.icon}
    </span>
  );
}
