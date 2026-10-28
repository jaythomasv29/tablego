'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Package, RefreshCw, ShoppingCart } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { restaurantClock } from '@/lib/reservations/availability';
import { workGoods } from '@/lib/work/goods';
import { inventoryCountedAt, inventoryTileState, inventoryTileLabels, inventoryChecked, inventoryReady, inventoryUnitOptions, inventoryDefaultUnit, inventoryOrderText, type InventoryDraft, type InventoryItem, type InventoryRecords } from '@/lib/inventory/model';
import { eligibleCrew, teamForStation, isInventoryTask, type WorkBoard } from '@/lib/work/model';
import styles from './inventory.module.css';
type Board = { customUnits: string[]; items: InventoryRecords; today: string; timezone: string };
const categories = Array.from(new Set(workGoods.map(g => g.category)));
async function request(path: string, body?: unknown) { const response = await fetch(path, { cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to save. Please try again.'); return data; }
export default function InventoryPage() {
  const [data, setData] = useState<Board | null>(null), [work, setWork] = useState<WorkBoard | null>(null);
  const [category, setCategory] = useState(categories[0]), [query, setQuery] = useState(''), [view, setView] = useState('pending');
  const [error, setError] = useState(''), [feedback, setFeedback] = useState(''), [refreshing, setRefreshing] = useState(false);
  const [taskId, setTaskId] = useState(''), [date, setDate] = useState(''), [finish, setFinish] = useState(false), [memberId, setMemberId] = useState(''), [finishing, setFinishing] = useState(false);
  const saving = useRef(new Set<string>()), generation = useRef(0), draftDay = useRef('');
  const draftsRef = useRef<Record<string, InventoryDraft>>({});
  const [drafts, setDrafts] = useState<Record<string, InventoryDraft>>({}), [online, setOnline] = useState(true), [draftWarning, setDraftWarning] = useState('');
  function persistDrafts(next: Record<string, InventoryDraft>) {
    draftsRef.current = next; setDrafts(next);
    try { localStorage.setItem(`tablego-inventory-drafts:${draftDay.current}`, JSON.stringify(next)); }
    catch { setDraftWarning('This browser cannot keep unfinished counts. Save each count before leaving this page.'); }
  }
  const changeDraft = (id: string, draft: InventoryDraft) => persistDrafts({ ...draftsRef.current, [id]: draft });
  useEffect(() => { const update = () => setOnline(navigator.onLine); update(); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  const load = useCallback(async () => { if (saving.current.size) return; const current = ++generation.current; setRefreshing(true); try { const params = new URLSearchParams(window.location.search); const day = params.get('date') || ''; const [inventory, board] = await Promise.all([request('/api/staff/inventory'), request(`/api/staff/work${day ? `?date=${encodeURIComponent(day)}` : ''}`)]); if (current !== generation.current) return;
      if (draftDay.current !== inventory.today) {
        draftDay.current = inventory.today;
        try {
          const stored = JSON.parse(localStorage.getItem(`tablego-inventory-drafts:${inventory.today}`) || '{}');
          const restored = Object.fromEntries(Object.entries(stored).filter(([id, value]) => { const draft = value as InventoryDraft; return workGoods.some(g => g.id === id) && draft && typeof draft.quantity === 'string' && draft.quantity.length <= 20 && inventoryUnitOptions(inventory.customUnits).includes(draft.unit); })) as Record<string, InventoryDraft>;
          draftsRef.current = restored; setDrafts(restored);
        } catch { setDraftWarning('Unfinished counts could not be restored. Save each count before leaving this page.'); }
      }
      setData(inventory); setWork(board); setDate(day || inventory.today); setTaskId(params.get('task') || ''); setError(''); } catch (e) { setError((e as Error).message); } finally { setRefreshing(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !saving.current.size && !Object.keys(draftsRef.current).length) void load(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 4500); return () => clearTimeout(timer); }, [feedback]);
  const checked = data ? workGoods.filter(g => inventoryChecked(data.items[g.id], data.today)).length : 0;
  const openOrders = data ? workGoods.filter(g => data.items[g.id]?.orderOpen).length : 0;
  const ready = data ? inventoryReady(data.items, data.today) : false;
  const readOnly = Boolean(data && date !== data.today);
  const task = work?.day.tasks.find(t => isInventoryTask(t) && (taskId ? t.id === taskId : !t.completedAt));
  async function save(id: string, quantity: number | undefined, unit: string, action: string, order?: { orderQuantity: number; orderUnit: string }) {
    if (!data || saving.current.has(id)) throw new Error('This item is already saving');
    if (!navigator.onLine) throw new Error('You are offline. Your count is kept on this phone; reconnect and save again.');
    ++generation.current; saving.current.add(id);
    try { const result = await request('/api/staff/inventory', { itemId: id, quantity, unit, action, ...order, version: data.items[id]?.version || 0, date: data.today }); setData(previous => previous ? { ...previous, items: { ...previous.items, [id]: result.item } } : previous); const remaining = { ...draftsRef.current }; if (quantity !== undefined || !remaining[id]?.quantity.trim()) delete remaining[id]; persistDrafts(remaining); setFeedback(action === 'order' ? 'Added to order list · No supplier order sent' : action === 'received' ? 'Stock received · Order request closed' : 'Stock sufficient · Recheck tomorrow'); }
    finally { saving.current.delete(id); }
  }
  async function addUnit(unit: string): Promise<string> {
    if (!data) throw new Error('Reload inventory before adding a unit');
    ++generation.current; saving.current.add('__custom_unit__');
    try {
      const result = await request('/api/staff/inventory', { action: 'addUnit', unit, date: data.today });
      setData(previous => previous ? { ...previous, customUnits: result.customUnits } : previous);
      return result.unit;
    } finally { saving.current.delete('__custom_unit__'); }
  }
  async function complete() {
    if (!data || !task || finishing || Object.keys(draftsRef.current).length || saving.current.size) return; setFinishing(true); setError('');
    try { const board: WorkBoard = await request(`/api/staff/work?date=${date}`); const result = await request('/api/staff/work', { action: 'complete', date, taskId: task.id, memberId, note: 'Inventory quantities and decisions recorded.', version: board.day.version, settingsVersion: board.day.settingsVersion }); setWork(result); setFinish(false); setFeedback('Inventory Check completed · Saved to the shift checklist'); }
    catch (e) { setError((e as Error).message); } finally { setFinishing(false); }
  }
  const shown = data ? workGoods.filter(g => (view === 'orders' || Boolean(query.trim()) || g.category === category) && (!query.trim() || `${g.name} ${g.detail || ''}`.toLowerCase().includes(query.trim().toLowerCase())) && (view !== 'pending' || !inventoryChecked(data.items[g.id], data.today)) && (view !== 'orders' || data.items[g.id]?.orderOpen)) : [];
  return <AdminLayout><main className={styles.page}>
    <header className={styles.header}><div><Link className={styles.back} href={`/admin/work${date ? `?date=${date}` : ''}`}><ArrowLeft aria-hidden="true" size={18} />Back to shift</Link><Link className={`${styles.back} ${styles.supplierLink}`} style={{ marginLeft: 16 }} href="/admin/inventory">Supplier tools & history</Link><p className={styles.eyebrow}>BOH · Daily stock routine</p><h1>Inventory Check</h1><p>Order quickly or review stock, one section at a time. Counts are optional.</p></div><Button variant="outline" className="min-h-11" disabled={refreshing} onClick={() => void load()}><RefreshCw aria-hidden="true" size={18} className="mr-2" />Refresh</Button></header>
    {error && <div role="alert" className={styles.error}>{error} <Button variant="outline" onClick={() => void load()}>Retry / Refresh</Button></div>}<div role="status" aria-live="polite" className={feedback ? styles.toast : undefined}>{feedback}</div>
    {draftWarning && <p role="alert" className={styles.notice}>{draftWarning}</p>}
    {!online && <p role="status" className={styles.notice}>Offline · Keep counting. Reconnect to save checks and order requests.</p>}
    {Object.keys(drafts).length > 0 && <p className={styles.notice}>{Object.keys(drafts).length} unsaved count{Object.keys(drafts).length === 1 ? '' : 's'} kept on this phone. Save the count with Recheck tomorrow, or include it when ordering.</p>}
    {!data ? <p>Loading inventory…</p> : <>
      <section className={styles.summary} aria-label="Inventory progress"><Package aria-hidden="true" /><div><strong>{checked} / {workGoods.length} reviewed today</strong><p>{data.today} · Saved across devices · {openOrders} open order requests</p><progress aria-label="Goods checked today" max={workGoods.length} value={checked} /></div><span>{ready ? 'Ready to finish' : `${workGoods.length - checked} to go`}</span></section>
      {readOnly && <p role="alert" className={styles.error}>This shift is for {date}. Inventory checks record today’s stock only. Open today’s Work board to check in.</p>}
      <nav className={styles.tabs} aria-label="Inventory views">{[['all', 'Check stock'], ['pending', 'Needs check'], ['orders', `Order list (${openOrders})`]].map(([id, name]) => <button key={id} aria-pressed={view === id} onClick={() => { setView(id); setQuery(''); }}>{id === 'orders' && <ShoppingCart aria-hidden="true" size={18} />}{name}</button>)}</nav>
      {view === 'orders' ? <div className={styles.intro}><h2>Order requests</h2><p>Daily check requests for internal review. Nothing is sent to suppliers. Requests stay here until stock is marked received. Supplier tools keep their separate order history.</p></div> : <nav className={styles.phases} aria-label="Inventory sections">{categories.map((name, i) => { const goods = workGoods.filter(g => g.category === name), count = goods.filter(g => inventoryChecked(data.items[g.id], data.today)).length; return <button key={name} aria-pressed={category === name} onClick={() => { setCategory(name); setQuery(''); }}><span>{count === goods.length ? <Check aria-hidden="true" size={16} /> : i + 1}</span><strong>{name}</strong><small>{count}/{goods.length}</small></button>; })}</nav>}
      {view !== 'orders' && <label className={styles.mobileSection}>Section<select value={category} onChange={e => { setCategory(e.target.value); setQuery(''); }}>{categories.map(name => <option key={name}>{name}</option>)}</select></label>}
      {view === 'orders' && <div className={styles.shareActions}><Button variant="outline" className="min-h-12" disabled={!openOrders} onClick={() => { void navigator.clipboard.writeText(inventoryOrderText(data.items)).then(() => setFeedback('Order list copied')).catch(() => setError('Unable to copy. Try Share list or select the order details.')); }}>Copy list</Button><Button variant="outline" className="min-h-12" disabled={!openOrders} onClick={() => { const text = inventoryOrderText(data.items); if (navigator.share) void navigator.share({ title: 'Restaurant order list', text }).catch(e => { if (e.name !== 'AbortError') setError('Unable to share this list. Try Copy list.'); }); else void navigator.clipboard.writeText(text).then(() => setFeedback('Order list copied')).catch(() => setError('Unable to copy this list.')); }}>Share list</Button></div>}
      <div className={styles.sectionHeader}><div><h2>{view === 'orders' ? 'Ready for review' : category}</h2>{view !== 'orders' && <Button variant="ghost" className="min-h-11 mt-1" onClick={() => { setCategory(categories[(categories.indexOf(category) + 1) % categories.length]); setQuery(''); }}>Next section →</Button>}</div><label>Find an item<input type="search" value={query} placeholder="Name, brand or size" onChange={e => setQuery(e.target.value)} /></label></div>
      <p className={styles.nextDayHint}>Previous counts stay saved. Each new day starts a fresh review; enter a new count only when you recount the item.</p>
      <div className={styles.legend} aria-label="Stock color guide">{(['checked', 'order', 'out', 'stale'] as const).map(state => <span key={state} data-stock={state}><i aria-hidden="true" />{inventoryTileLabels[state]}</span>)}</div>
      <div className={styles.items}>{shown.map(good => <Item key={good.id} good={good} units={inventoryUnitOptions(data.customUnits)} addUnit={addUnit} draft={drafts[good.id]} changeDraft={changeDraft} item={data.items[good.id]} date={data.today} timezone={data.timezone} disabled={readOnly || !online} readOnly={readOnly} orderView={view === 'orders'} save={save} />)}</div>
      {!shown.length && <p className={styles.empty}>{view === 'orders' ? 'No open order requests match.' : 'No items left in this view. Choose another section or clear your search.'}</p>}
      <footer className={styles.finish}><div><strong>{task?.completedAt ? 'Inventory Check is complete' : ready ? 'All goods have a decision' : 'Finish one section, then move to the next'}</strong><p>Checks carry across today’s shifts. Sufficient stock is due for recheck tomorrow.</p></div>{task && !task.completedAt ? <Button className="min-h-12" disabled={!ready || readOnly || !online || Object.keys(drafts).length > 0} onClick={() => { setMemberId(''); setFinish(true); }}>Finish Inventory Check</Button> : <Link className={styles.back} href={`/admin/work?date=${date}`}>Return to Work</Link>}</footer>
    </>}
    <Dialog open={finish} onOpenChange={open => { if (!finishing) setFinish(open); }}><DialogContent><DialogTitle>Finish Inventory Check</DialogTitle><DialogDescription>Save this shift task with the completion time. All goods have a saved Order or Recheck tomorrow decision. Counts remain optional.</DialogDescription><label className={styles.crew}>Completed by (optional)<select value={memberId} onChange={e => setMemberId(e.target.value)}><option value="">{teamForStation(task?.station || 'Back of house', work?.settings.stationCrews)} (default)</option>{eligibleCrew(work?.crew || [], task?.station || 'Back of house', work?.settings.stationCrews).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>{error && <p role="alert">{error}</p>}<Button disabled={finishing} onClick={() => void complete()}>{finishing ? 'Saving…' : 'Confirm completion'}</Button></DialogContent></Dialog>
  </main></AdminLayout>;
}
function Item({ good, item, units, addUnit, draft, changeDraft, date, timezone, disabled, readOnly, orderView, save }: {
  good: typeof workGoods[number]; item?: InventoryItem; units: string[]; addUnit: (name: string) => Promise<string>; draft?: InventoryDraft;
  changeDraft: (id: string, value: InventoryDraft) => void;
  date: string; timezone: string; disabled: boolean; readOnly: boolean; orderView: boolean;
  save: (id: string, quantity: number | undefined, unit: string, action: string, order?: { orderQuantity: number; orderUnit: string }) => Promise<void>;
}) {
  const countedAt = inventoryCountedAt(item);
  const countedToday = countedAt ? restaurantClock(timezone, new Date(countedAt)).date === date : false;
  const quantity = draft?.quantity ?? (item && countedToday && item.quantity !== null ? String(item.quantity) : ''), unit = draft?.unit || item?.unit || inventoryDefaultUnit(good.detail);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [ordering, setOrdering] = useState(false);
  const [includeCount, setIncludeCount] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false), [history, setHistory] = useState<{ id: string; action: string; at: string; before: InventoryItem | null; after: InventoryItem | null }[] | null>(null), [historyError, setHistoryError] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('1'), [orderUnit, setOrderUnit] = useState(unit);
  const checked = inventoryChecked(item, date), stockState = inventoryTileState(item, date);
  const name = `${good.name}${good.detail ? ` ${good.detail}` : ''}`;
  const edit = (value: string, nextUnit = unit) => changeDraft(good.id, { quantity: value, unit: nextUnit });
  function order() {
    setError('');
    setIncludeCount(false);
    setOrderQuantity(String(item?.orderQuantity || 1)); setOrderUnit(item?.orderUnit || unit); setOrdering(true);
  }
  async function commit(action: string) {
    if (busy) return; setError('');
    setBusy(true);
    try { await save(good.id, quantity.trim() && (action !== 'order' || includeCount) ? Number(quantity) : undefined, unit, action, action === 'order' ? { orderQuantity: Number(orderQuantity), orderUnit } : undefined); setOrdering(false); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function showHistory() {
    setHistoryOpen(true); setHistory(null); setHistoryError('');
    try { const result = await request(`/api/staff/inventory?history=${encodeURIComponent(good.id)}`); setHistory(result.events); }
    catch (e) { setHistoryError((e as Error).message); }
  }
  return <article className={styles.item} data-checked={checked} data-stock={stockState} data-draft={Boolean(draft)}>
    <div className={styles.itemTitle}><div><h3>{good.name}</h3><p>{good.detail || good.category}</p></div><span>{draft ? 'Not saved' : inventoryTileLabels[stockState]}</span></div>
    {item?.orderOpen && <p className={styles.orderAmount}><ShoppingCart aria-hidden="true" size={16} />{item.orderQuantity !== undefined ? `To order: ${item.orderQuantity} ${item.orderUnit || item.unit}` : 'Set quantity to order'}</p>}
    {item ? <p className={styles.receipt}>Updated <time dateTime={item.checkedAt} title={timezone}>{new Date(item.checkedAt).toLocaleString('en-US', { timeZone: timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time> · {item.checkedBy}{item.orderOpen ? ' · Order request open' : ` · Next check ${item.nextCheck}`}</p> : <p className={styles.receipt}>Updated: Not checked yet</p>}
      <div className={styles.lastCount}><span>{item?.quantity !== null && item?.quantity !== undefined && countedAt ? <>Last counted: <strong>{item.quantity} {item.unit}</strong> · {new Date(countedAt).toLocaleString('en-US', { timeZone: timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</> : 'No count recorded yet'}</span><button type="button" onClick={() => void showHistory()}>History</button></div>
    <fieldset disabled={busy || readOnly}>
      <legend className="sr-only">Count {good.name}</legend>

      <div className={styles.count}>
        <label><span className={styles.quantityHeading}>On hand (optional)<span key={`${quantity}-${unit}`} className={styles.quantityLive} aria-hidden="true">{quantity || '—'} {unit}</span></span><input aria-label={`Quantity for ${name}`} inputMode="decimal" type="number" min="0" max="999999" step="0.01" placeholder={countedToday ? "Enter amount" : "New count"} value={quantity} onFocus={e => e.target.select()} onChange={e => edit(e.target.value)} /></label>
        <UnitSelect label="Unit" ariaLabel={`Unit for ${name}`} value={unit} onChange={value => edit(quantity, value)} units={units} addUnit={addUnit} />
        <button type="button" aria-label={`Decrease quantity for ${good.name}`} onClick={() => edit(String(Math.max(0, Math.round((Number(quantity) - 1) * 100) / 100)))}>−</button>
        <button type="button" aria-label={`Increase quantity for ${good.name}`} onClick={() => edit(String(Math.min(999999, Math.round((Number(quantity) + 1) * 100) / 100)))}>+</button>
      </div>
      <div className={styles.actions}><button disabled={disabled} onClick={order}>{busy ? 'Saving…' : item?.orderOpen ? 'Edit order' : 'Order'}</button><button disabled={disabled} className={styles.sufficient} onClick={() => void commit('sufficient')}>Recheck tomorrow</button></div>
      {orderView && item?.orderOpen && <button disabled={disabled} className={styles.received} onClick={() => void commit('received')}>Stock received · Close request</button>}
    </fieldset>
    {error && !ordering && <p role="alert" className={styles.error}>{error}</p>}
    <Dialog open={ordering} onOpenChange={open => { if (!busy) setOrdering(open); }}><DialogContent className={styles.orderDialog}><DialogTitle>Order {good.name}</DialogTitle><DialogDescription>{good.detail ? `${good.detail} · ` : ''}Add the amount you want to buy. An on-hand count is not required.</DialogDescription>
      <form onSubmit={e => { e.preventDefault(); void commit('order'); }} className={styles.orderForm}>
        <label>Quantity to order<input required aria-label={`Quantity to order for ${good.name}`} inputMode="decimal" type="number" min="0.01" max="999999" step="0.01" value={orderQuantity} onFocus={e => e.target.select()} onChange={e => setOrderQuantity(e.target.value)} /></label>
        <UnitSelect label="Ordering unit" value={orderUnit} onChange={setOrderUnit} units={units} addUnit={addUnit} />
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {quantity.trim() && <label className={styles.includeCount}><input type="checkbox" checked={includeCount} onChange={event => setIncludeCount(event.target.checked)} />Also save this count: {quantity} {unit}</label>}
        <p>Request only. No supplier order is sent.</p><Button className="min-h-12" type="submit" disabled={busy || disabled}>{busy ? 'Saving…' : 'Save to order list'}</Button>
      </form>
    </DialogContent></Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogTitle>{good.name} history</DialogTitle><DialogDescription>Recent saved reviews, order requests, and counts. Ordering without a count keeps the earlier amount and count time. Older activity stays saved.</DialogDescription>
      {historyError ? <p role="alert">{historyError}</p> : history === null ? <p>Loading history…</p> : !history.length ? <p>No saved activity yet.</p> : <ol className={styles.historyList}>{history.map(event => { const after = event.after; const newCount = after && inventoryCountedAt(after) === event.at; return <li key={event.id}><strong>{event.action === 'order' ? `Order: ${after?.orderQuantity ?? '—'} ${after?.orderUnit || ''}` : event.action === 'received' ? 'Stock received' : 'Sufficient · Recheck tomorrow'}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time><p>{newCount ? `Counted: ${after.quantity} ${after.unit}` : 'No new count recorded'}{!newCount && after?.quantity !== null && after?.quantity !== undefined ? ` · Kept ${after.quantity} ${after.unit}` : ''}</p></li>; })}</ol>}
    </DialogContent></Dialog>
  </article>;
}

function UnitSelect({ label, ariaLabel, value, onChange, units, addUnit }: {
  label: string; ariaLabel?: string; value: string; onChange: (unit: string) => void;
  units: string[]; addUnit: (name: string) => Promise<string>;
}) {
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); event.stopPropagation(); if (busy) return; setBusy(true); setError('');
    try { const unit = await addUnit(name); onChange(unit); setOpen(false); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <label>{label}<select aria-label={ariaLabel || label} value={value} onChange={event => {
      if (event.target.value === '__custom__') { setName(''); setError(''); setOpen(true); }
      else onChange(event.target.value);
    }}>{units.map(unit => <option key={unit} value={unit}>{unit}</option>)}<option value="__custom__">+ Custom unit…</option></select></label>
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}><DialogContent>
      <DialogTitle>Add custom unit</DialogTitle><DialogDescription>Save a unit for counting and ordering on every device. Examples: tray, tub, bundle.</DialogDescription>
      <form className={styles.orderForm} onSubmit={submit}>
        <label>Unit name<input required maxLength={24} value={name} onChange={event => setName(event.target.value)} autoComplete="off" placeholder="e.g. tray" /></label>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <Button type="submit" className="min-h-12" disabled={busy}>{busy ? 'Saving…' : 'Add unit'}</Button>
      </form>
    </DialogContent></Dialog>
  </>;
}
