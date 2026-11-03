'use client';
import { useState } from 'react';
import { Activity, Copy, RefreshCw, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DailyStockView, {stockDate} from './DailyStockView';
import { useDailyStock } from './useDailyStock';
import styles from './DailyStock.module.css';
export default function InventoryDailyStock() {
  const [open, setOpen] = useState(false), [sharing, setSharing] = useState(false);
  const [link, setLink] = useState(''), [expiresAt, setExpiresAt] = useState(''), [feedback, setFeedback] = useState(''), [shareError, setShareError] = useState('');
  const {board, error, loading, stale, refresh} = useDailyStock(open);
  async function createLink() {
    if (sharing) return;
    setSharing(true); setShareError(''); setFeedback('');
    try {
      const response = await fetch('/api/staff/inventory/daily-stock/share', {method: 'POST'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create a share link.');
      const url = new URL('/inventory/daily-stock', window.location.origin);
      url.hash = new URLSearchParams({token: data.token}).toString();
      setLink(url.toString()); setExpiresAt(data.expiresAt);
      setFeedback('Read-only link ready. Anyone with this link can view daily stock until it expires.');
    } catch (error) { setShareError((error as Error).message); }
    finally { setSharing(false); }
  }
  async function copyLink() {
    setShareError('');
    try { await navigator.clipboard.writeText(link); setFeedback('Link copied. Share it with your managers or staff.'); }
    catch { setShareError('Copy is unavailable here. Select and copy the link below.'); }
  }
  async function shareLink() {
    if (!navigator.share) { await copyLink(); return; }
    try { await navigator.share({title: 'Daily stock', text: 'Current stock by category · read-only view', url: link}); }
    catch (error) { if ((error as Error).name !== 'AbortError') setShareError('Sharing is unavailable here. Copy the link below.'); }
  }
  return <>
    <button type="button" className={styles.trigger} onClick={() => {setOpen(true); setShareError('');}}><Activity size={18} aria-hidden="true"/>Daily stock</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={`${styles.dialog} ${styles.shell}`}>
        <header className={styles.modalHeader}><p className={styles.eyebrow}>Inventory at a glance</p><DialogTitle className={styles.title}>Daily stock</DialogTitle><DialogDescription className={styles.description}>Every item, by category. See the last known count and when stock was checked.</DialogDescription></header>
        <div className={styles.toolbar}>
          <div className={styles.update} role="status"><strong>{!board && loading ? 'Loading stock…' : stale ? 'Updates paused' : 'Auto-updating · every 30 seconds'}</strong><span>{board ? `Updated ${stockDate(board.updatedAt, board.timezone)}` : loading ? 'Loading stock…' : 'Waiting for stock'}</span></div>
          <div className={styles.toolbarActions}><button type="button" disabled={loading} onClick={() => void refresh()} aria-label="Refresh daily stock" className={styles.iconAction}><RefreshCw size={16} aria-hidden="true"/><span>{loading ? 'Refreshing…' : 'Refresh'}</span></button><button type="button" disabled={sharing} onClick={() => void createLink()}><Share2 size={16} aria-hidden="true"/>{sharing ? 'Creating…' : 'Share view'}</button></div>
        </div>
        <div className={styles.scroll}>
          {error && <p className={`${styles.notice} ${styles.error}`} role="alert">{error} {board ? 'Showing the last successful update.' : ''}</p>}
          {link && <div className={styles.shareBox}>
            <p role="status">{feedback}</p><label>Read-only share link<input readOnly value={link} onFocus={e => e.target.select()}/></label>
            <div className={styles.toolbarActions}><button type="button" onClick={() => void copyLink()}><Copy size={16} aria-hidden="true"/>Copy link</button><button type="button" onClick={() => void shareLink()}><Share2 size={16} aria-hidden="true"/>Share link</button></div>
            <p>Expires {stockDate(expiresAt, board?.timezone || 'UTC')}. The shared view includes quantities and check dates, and updates automatically.</p>
          </div>}
          {shareError && <p className={`${styles.notice} ${styles.error}`} role="alert">{shareError}</p>}
          {board ? <DailyStockView board={board} stale={stale}/> : <p className={styles.empty} role="status">{loading ? 'Loading every inventory item…' : 'Stock is unavailable. Try Refresh.'}</p>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
