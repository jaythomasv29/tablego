"use client";
import { memo, useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls, useDragControls, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Layers, ShoppingCart } from 'lucide-react';
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
    <p className={styles.hint}>Swipe left for Enough. Swipe right to add to your order list.</p>
    <div role="status" className={styles.announcement}>{message}</div>
    {good ? <div className={styles.stage}>
      {next && <div aria-hidden="true" className={styles.backCard}><span>Up next · {next.category}</span><strong>{next.name}</strong></div>}
      <SwipeStockCard key={good.id} focusOnMount={finished > 0} good={good} board={board} onSaved={onSaved} onDraftChange={onDraftChange} onReviewed={decision => {
        setMessage(`${good.name}: ${decision === 'order' ? 'order marked' : decision === 'count' ? 'count saved' : 'enough for now'}`);
        setQueue(previous => previous.filter(id => id !== good.id)); setFinished(previous => previous + 1);
      }} />
    </div> : <div className={styles.complete}><CheckCircle2 aria-hidden="true" size={36} /><h3>{selection.current.length ? 'Selection reviewed' : 'No items in this selection'}</h3><p>{finished} cards completed. Choose another category or switch to Multi-card to revisit items. Any unfinished counts remain in Unsaved.</p></div>}
  </section>;
}

type CardProps = Omit<Props, 'goods'> & { good: CatalogGood; onReviewed?: (decision: string) => void; compact?: boolean; focusOnMount?: boolean; onEdit?: (good: CatalogGood) => void; onHistory?: (good: CatalogGood) => void };
function shallowSame(a: object | undefined, b: object | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>, keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => left[key] === right[key]);
}
// A full stock walk renders every card; a tap must repaint only the card it changed.
export const SwipeStockCard = memo(SwipeStockCardView, (a, b) => shallowSame(a.good, b.good) && shallowSame(a.board.stock[a.good.id], b.board.stock[b.good.id]) && a.board.today === b.board.today && a.board.timezone === b.board.timezone && a.board.customUnits.join('|') === b.board.customUnits.join('|') && a.onSaved === b.onSaved && a.onDraftChange === b.onDraftChange && a.onReviewed === b.onReviewed && a.compact === b.compact && a.focusOnMount === b.focusOnMount && a.onEdit === b.onEdit && a.onHistory === b.onHistory);
function SwipeStockCardView({ good, board, onSaved, onDraftChange, onReviewed, compact = false, focusOnMount = false, onEdit, onHistory }: CardProps) {
  const [locked, setLocked] = useState(true), [leaving, setLeaving] = useState(false);
  const form = useRef<{ recheck: () => void; order: () => void }>(null);
  const transitioning = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focusOnMount) heading.current?.focus({ preventScroll: true }); }, [focusOnMount]);
  const animation = useAnimationControls(), reduced = useReducedMotion(), x = useMotionValue(0), drag = useDragControls();
  const rotate = useTransform(x, [-180,180], reduced ? [0,0] : [-9,9]);
  const item = board.stock[good.id], state = item?.orderOpen ? 'order' : inventoryChecked(item, board.today) ? 'enough' : 'open';
  const leftOpacity = useTransform(x, [-100,-20,0], [1,0,0]), rightOpacity = useTransform(x, [0,20,100], [0,0,1]);
  async function committed(decision: string) {
    if (transitioning.current || !['sufficient','order','count'].includes(decision)) return;
    transitioning.current = true;
    // Advance on the local acknowledgment, without waiting for an exit animation.
    if (onReviewed) { onReviewed(decision); return; }
    setLeaving(true);
    const direction = decision === 'order' ? 1 : -1;
    await animation.start({ x: reduced ? 0 : direction * 8, transition: { duration: reduced ? 0 : .05 } });
    await animation.start({ x: 0, transition: { duration: reduced ? 0 : .06, ease: 'easeOut' } });
    animation.set({ x: 0, opacity: 1 }); x.set(0); setLeaving(false); transitioning.current = false;
  }
  return (
      <motion.article data-stock-card={compact ? 'compact' : 'single'} data-state={state} key={good.id} className={`${styles.card} ${compact ? styles.compact : ''}`} style={{ x, rotate }} animate={animation}
        drag={!locked && !leaving ? 'x' : false} dragControls={drag} dragListener={false} dragConstraints={{ left: 0, right: 0 }} dragElastic={.45} dragTransition={{ bounceStiffness: 420, bounceDamping: 32 }}
        onDragEnd={(_, info) => { if (locked || transitioning.current) return; if (Math.abs(info.offset.x) < (compact ? 60 : 85) || Math.abs(info.offset.x) < Math.abs(info.offset.y) * 1.5) return; if (info.offset.x > 0) form.current?.order(); else form.current?.recheck(); }}>
        <div className={styles.swipeSurface}
          onPointerDown={event => { if (locked || leaving || event.button !== 0) return; drag.start(event); }}>
          <span className={styles.grip} aria-hidden="true" />
          <div className={styles.head}><p>{good.category}{good.location ? ` · ${good.location}` : ''}</p><span className={styles.badge} aria-live="polite">{state === 'order' ? <><ShoppingCart size={13} aria-hidden="true" />To order</> : state === 'enough' ? <><Check size={13} aria-hidden="true" />Enough</> : null}</span></div>
          <h3 tabIndex={-1} ref={heading}>{good.name}</h3>
          {good.detail && <p>{good.detail}</p>}
          <div className={styles.directions}><span><ArrowLeft size={15} aria-hidden="true" />Enough</span><span>Order<ArrowRight size={15} aria-hidden="true" /></span></div>
        </div>
        <motion.span aria-hidden="true" className={`${styles.stamp} ${styles.left}`} style={{ opacity: leftOpacity }}>ENOUGH</motion.span>
        <motion.span aria-hidden="true" className={`${styles.stamp} ${styles.right}`} style={{ opacity: rightOpacity }}>ORDER</motion.span>
        <fieldset disabled={leaving} style={{ minWidth: 0 }}><InlineStockCheck good={good} item={board.stock[good.id]} units={inventoryUnitOptions([...board.customUnits, good.baseUnit])} date={board.today} timezone={board.timezone} onSaved={onSaved} onDraftChange={onDraftChange} card controls={form} onInteractionChange={setLocked} onCommitted={decision => void committed(decision)} /></fieldset>
        {(onEdit || onHistory) && <div className={styles.tools}>{onEdit && <button type="button" onClick={() => onEdit(good)}>Edit item</button>}{onHistory && <button type="button" onClick={() => onHistory(good)}>History & sources</button>}</div>}
      </motion.article>
  );
}
