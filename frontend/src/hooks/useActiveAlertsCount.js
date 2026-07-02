import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/apiClient';
import { useAlertEvents } from './useSocket';

const POLL_MS = 60000;

export function useActiveAlertsCount() {
  const [count, setCount] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { meta } = await api.getAlerts({ status: 'active', limit: 1 });
      setCount(meta?.total ?? 0);
    } catch {
      // Non-critical UI element — fail silently, keep showing the last known count.
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  useAlertEvents(
    useCallback((alert) => {
      if (alert.status === 'active') setCount((c) => (c === null ? 1 : c + 1));
    }, [])
  );

  return count;
}