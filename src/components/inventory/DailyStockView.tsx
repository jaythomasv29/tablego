'use client';
import { useId, useState } from 'react';
import { Search, Package, CheckCheck, ClipboardList, AlertCircle } from 'lucide-react';
import { dailyStockLabels, dailyStockSummary, type DailyStockBoard } from '@/lib/inventory/dailyStock';
import styles from './DailyStock.module.css';
export function stockDate(value: string | null, timezone: string) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Never';
  return new Date(value).toLocaleString('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export default function DailyStockView({ board, stale = false }: { board: DailyStockBoard; stale?: boolean }) {
  const [category, setCategory] = useState(''), [query, setQuery] = useState(''), [animate, setAnimate] = useState(true);
  const id = useId();
  const categories = Array.from(new Set(board.rows.map(row => row.category)));
  const summary = dailyStockSummary(board);
  const visible = board.rows.filter(row => (!category || row.category === category) && `${row.name} ${row.detail} ${row.location}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const day = new Date(`${board.today}T12:00:00Z`).toLocaleDateString('en-US', {timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric'});
  return <div className={styles.view} data-stale={stale} data-animate={animate}>
    <div className={styles.day}><span>{day}</span><span>{board.timezone.split('/').at(-1)?.replace(/_/g, ' ')} time</span></div>
    <div className={styles.summary} aria-label="Daily inventory summary">
      {[{label: 'Total items', value: summary.total, Icon: Package}, {label: 'Checked today', value: summary.reviewed, Icon: CheckCheck}, {label: 'Need a check', value: summary.remaining, Icon: ClipboardList}, {label: 'Last counted zero', value: summary.out, Icon: AlertCircle}].map(({label, value, Icon}) => <div key={label}><Icon size={17} aria-hidden="true"/><strong>{value}</strong><span>{label}</span></div>)}
    </div>
    <div className={styles.filters}>
      <label className={styles.search} htmlFor={id}><Search size={18} aria-hidden="true"/><span className="sr-only">Search daily stock</span><input id={id} value={query} placeholder="Find an item or location…" onChange={e => setQuery(e.target.value)}/></label>
      <div className={styles.categories} aria-label="Filter stock by category">
        <button type="button" aria-pressed={!category} onClick={() => setCategory('')}>All categories <span>{board.rows.length}</span></button>
        {categories.map(name => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name} <span>{board.rows.filter(row => row.category === name).length}</span></button>)}
      </div>
    </div>
    <div className={styles.legend}><p>Last physical count · Check status</p><button type="button" onClick={() => setAnimate(value => !value)}>{animate ? 'Pause dots' : 'Animate dots'}</button></div>
    <div className={styles.groups}>
      {categories.filter(name => visible.some(row => row.category === name)).map(name => <section key={name} aria-label={name} className={styles.group}>
        <header className={styles.groupHeader}><h3>{name}</h3><span>{visible.filter(row => row.category === name).length} item{visible.filter(row => row.category === name).length === 1 ? '' : 's'}</span></header>
        <ul>{visible.filter(row => row.category === name).map(row => <li key={row.id} className={styles.stockRow}>
          <span className={styles.dot} data-state={row.state} aria-hidden="true"/>
          <div className={styles.item}><strong>{row.name}</strong>{(row.detail || row.location) && <span>{[row.detail, row.location].filter(Boolean).join(' · ')}</span>}<span className={styles.state} data-state={row.state}>{dailyStockLabels[row.state]}{row.reviewedToday && row.state !== 'checked' ? ' · Checked today' : ''}</span></div>
          <div className={styles.amount}><strong>{row.quantity === null ? '—' : row.quantity.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong><span>{row.quantity === null ? 'Not counted' : row.unit}</span></div>
          <div className={styles.dates}><span>Last checked <time dateTime={row.checkedAt || undefined}>{stockDate(row.checkedAt, board.timezone)}</time></span><span>Last counted <time dateTime={row.countedAt || undefined}>{stockDate(row.countedAt, board.timezone)}</time></span></div>
        </li>)}</ul>
      </section>)}
      {!visible.length && <p className={styles.empty}>{board.rows.length ? 'No items match this search. Try another category or item name.' : 'No inventory items yet.'}</p>}
    </div>
  </div>;
}
