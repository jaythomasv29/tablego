'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import DailyStockView, {stockDate} from './DailyStockView';
import { useDailyStock } from './useDailyStock';
import styles from './DailyStock.module.css';
export default function SharedDailyStock() {
  const [token, setToken] = useState(''), [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') || ''); setReady(true);};
    read(); window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const {board, error, loading, stale, refresh} = useDailyStock(ready && !!token, token);
  return <main className={`${styles.sharedPage} ${styles.shell}`}>
    <div className={styles.sharedPanel}>
      <header className={styles.modalHeader}><p className={styles.eyebrow}>Shared inventory · Read only</p><h1 className={styles.title}>Daily stock</h1><p className={styles.description}>A quick look at stock, organised by category. Quantities show the last physical count.</p></header>
      <div className={styles.toolbar}>
        <div className={styles.update} role="status"><strong>{!board && loading ? 'Loading stock…' : stale ? 'Updates paused' : 'Auto-updating · every 30 seconds'}</strong><span>{board ? `Updated ${stockDate(board.updatedAt, board.timezone)}` : 'A current view of the inventory'}</span></div>
        {!!token && <button type="button" disabled={loading} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true"/>{loading ? 'Refreshing…' : 'Refresh'}</button>}
      </div>
      {ready && !token && <p className={styles.notice} role="alert">Open the complete link shared by a manager to view daily stock.</p>}
      {error && <p className={`${styles.notice} ${styles.error}`} role="alert">{error} {board ? 'Showing the last successful update.' : ''}</p>}
      {board && <DailyStockView board={board} stale={stale}/>}
      {loading && !board && <p className={styles.empty} role="status">Loading daily stock…</p>}
    </div>
  </main>;
}
