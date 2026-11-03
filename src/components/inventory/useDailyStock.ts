'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyStockBoard } from '@/lib/inventory/dailyStock';
export function useDailyStock(active: boolean, token?: string) {
  const [board, setBoard] = useState<DailyStockBoard | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [stale, setStale] = useState(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!active) return;
    let disposed = false, fetching = false;
    const controller = new AbortController();
    setBoard(null); setError(''); setStale(true);
    async function refresh() {
      if (fetching || disposed || document.visibilityState === 'hidden') return;
      fetching = true; setLoading(true);
      try {
        const response = await fetch(token ? '/api/inventory/daily-stock' : '/api/staff/inventory/daily-stock', {
          cache: 'no-store', signal: controller.signal,
          ...(token ? {headers: {Authorization: `Bearer ${token}`}} : {}),
        });
        const data = await response.json();
        if (!response.ok) {
          if (!disposed && (response.status === 401 || response.status === 403)) setBoard(null);
          throw new Error(data.error || 'Stock updates are temporarily unavailable.');
        }
        if (!disposed) { setBoard(data); setError(''); setStale(false); }
      } catch (error) {
        if (!disposed) { setError((error as Error).message); setStale(true); }
      } finally {
        fetching = false;
        if (!disposed) setLoading(false);
      }
    }
    refreshRef.current = refresh;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      disposed = true; controller.abort(); window.clearInterval(interval);
      window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus);
      refreshRef.current = async () => {};
    };
  }, [active, token]);
  const refresh = useCallback(() => refreshRef.current(), []);
  return {board, error, loading, stale, refresh};
}
