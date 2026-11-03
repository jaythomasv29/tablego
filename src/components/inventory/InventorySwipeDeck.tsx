"use client";
import { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import InlineStockCheck from './InlineStockCheck';
import { inventoryChecked, inventoryUnitOptions } from '@/lib/inventory/model';
import type { CatalogGood, OperationsBoard } from '@/lib/inventory/operations';
import styles from './InventorySwipeDeck.module.css';

type StockBoard = Pick<OperationsBoard, 'goods' | 'stock' | 'customUnits' | 'today' | 'timezone'>;
type Props = { board: StockBoard; goods: CatalogGood[]; onSaved: (board: OperationsBoard) => void; onDraftChange: (id: string, dirty: boolean) => void };
export default function InventorySwipeDeck({ board, goods, onSaved, onDraftChange }: Props) {
  // Keep the active card mounted until its confirmed save animation finishes,
  // even when a "needs check" filter removes it from the parent's results.
  const [queue, setQueue] = useState(() => {
    const categories = Array.from(new Set(goods.map(g => g.category)));
    return categories.flatMap(category => goods.filter(g => g.category === category).map(g => g.id));
  });
  const [finished, setFinished] = useState(0), [message, setMessage] = useState('');
  const selection = useRef(queue);
  const good = queue.map(id => board.goods.find(g => g.id === id)).find(Boolean);
  const next = queue.filter(id => id !== good?.id).map(id => board.goods.find(g => g.id === id)).find(Boolean);
  const checked = selection.current.filter(id => inventoryChecked(board.stock[id], board.today)).length;
  return <section className={styles.deck} aria-label="Swipe inventory cards">
    <div className={styles.progress}><span><Layers size={16} aria-hidden="true" />{good?.category || 'Review complete'}</span><strong>{checked}/{selection.current.length} checked</strong></div>
    <progress aria-label="Items checked in this selection" value={checked} max={selection.current.length || 1} />
    <p className={styles.hint}>Swipe left to check tomorrow. Swipe right to choose an order amount.</p>
    <div role="status" className={styles.announcement}>{message}</div>
    {good ? <div className={styles.stage}>
      {next && <div aria-hidden="true" className={styles.backCard}><span>Up next · {next.category}</span><strong>{next.name}</strong></div>}
      <SwipeStockCard key={good.id} focusOnMount={finished > 0} good={good} board={board} onSaved={onSaved} onDraftChange={onDraftChange} onReviewed={decision => {
        setMessage(`${good.name}: ${decision === 'order' ? 'order request saved' : decision === 'count' ? 'count saved' : 'checked · recheck tomorrow'}`);
        setQueue(previous => previous.filter(id => id !== good.id)); setFinished(previous => previous + 1);
      }} />
    </div> : <div className={styles.complete}><CheckCircle2 aria-hidden="true" size={36} /><h3>{selection.current.length ? 'Selection reviewed' : 'No items in this selection'}</h3><p>{finished} cards completed. Choose another category or switch to Multi-card to revisit items. Any unfinished counts remain in Unsaved.</p></div>}
  </section>;
}

export function SwipeStockCard({ good, board, onSaved, onDraftChange, onReviewed, compact = false, focusOnMount = false }: Omit<Props, 'goods'> & { good: CatalogGood; onReviewed?: (decision: string) => void; compact?: boolean; focusOnMount?: boolean }) {
  const [locked, setLocked] = useState(true), [leaving, setLeaving] = useState(false);
  const form = useRef<{ recheck: () => void; order: () => void }>(null);
  const transitioning = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focusOnMount) heading.current?.focus({ preventScroll: true }); }, [focusOnMount]);
  const animation = useAnimationControls(), reduced = useReducedMotion(), x = useMotionValue(0), drag = useDragControls();
  const rotate = useTransform(x, [-180,180], reduced ? [0,0] : [-9,9]);
  const leftOpacity = useTransform(x, [-100,-20,0], [1,0,0]), rightOpacity = useTransform(x, [0,20,100], [0,0,1]);
  async function committed(decision: string) {
    if (transitioning.current || !['sufficient','order','count'].includes(decision)) return;
    transitioning.current = true; setLeaving(true);
    const direction = decision === 'order' ? 1 : -1;
    if (onReviewed) {
      await animation.start({ x: reduced ? 0 : direction * 360, opacity: 0, transition: { duration: reduced ? 0 : .24, ease: 'easeIn' } });
    } else {
      await animation.start({ x: reduced ? 0 : direction * 8, transition: { duration: reduced ? 0 : .1 } });
    }
    animation.set({ x: 0, opacity: 1 }); x.set(0); setLeaving(false); transitioning.current = false;
    onReviewed?.(decision);
  }
  return (
      <motion.article key={good.id} className={`${styles.card} ${compact ? styles.compact : ''}`}  style={{ x, rotate }} animate={animation}
        drag={!locked && !leaving ? 'x' : false} dragControls={drag} dragListener={false} dragConstraints={{ left: 0, right: 0 }} dragElastic={.65}
        onDragEnd={(_, info) => { x.set(0); if (locked || transitioning.current) return; if (Math.abs(info.offset.x) < 85 || Math.abs(info.offset.x) < Math.abs(info.offset.y) * 1.5) return; if (info.offset.x > 0) form.current?.order(); else form.current?.recheck(); }}>
        <div className={styles.swipeSurface}
          onPointerDown={event => { if (locked || leaving || event.button !== 0) return; drag.start(event); }}>
          <span className={styles.grip} aria-hidden="true" />
          <p>{good.category}{good.location ? ` · ${good.location}` : ''}</p>
          <h3 tabIndex={-1} ref={heading}>{good.name}</h3>
          {good.detail && <p>{good.detail}</p>}
          <div className={styles.directions}><span><ArrowLeft size={15} aria-hidden="true" />Check tomorrow</span><span>Order<ArrowRight size={15} aria-hidden="true" /></span></div>
        </div>
        <motion.span aria-hidden="true" className={`${styles.stamp} ${styles.left}`} style={{ opacity: leftOpacity }}>CHECK TOMORROW</motion.span>
        <motion.span aria-hidden="true" className={`${styles.stamp} ${styles.right}`} style={{ opacity: rightOpacity }}>ORDER</motion.span>
        <fieldset disabled={leaving} style={{ minWidth: 0 }}><InlineStockCheck good={good} item={board.stock[good.id]} units={inventoryUnitOptions([...board.customUnits, good.baseUnit])} date={board.today} timezone={board.timezone} onSaved={onSaved} onDraftChange={onDraftChange} card controls={form} onInteractionChange={setLocked} onCommitted={decision => void committed(decision)} /></fieldset>
      </motion.article>
  );
}
