'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronRight, Inbox, RefreshCw, Search, Users, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateForDisplay, formatBusinessTimestamp } from '@/utils/dateUtils';
import { cateringFollowUpDue, closedCatering, filterCatering, type CateringFilter, type CateringLead } from '@/lib/catering/admin';
import PhoneNumber from '@/components/PhoneNumber';
import CateringStage from './CateringStage';
import CateringDetails from './CateringDetails';

const filters: { value: CateringFilter; label: string }[] = [{ value: 'active', label: 'Active' }, { value: 'pending', label: 'New' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }];
export default function CateringInbox() {
  const [data, setData] = useState<{ leads: CateringLead[]; timezone: string; loadedAt: string } | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [filter, setFilter] = useState<CateringFilter>('active'), [search, setSearch] = useState(''), [dueOnly, setDueOnly] = useState(false), [sort, setSort] = useState<'newest' | 'event'>('event');
  const [selected, setSelected] = useState<CateringLead | null>(null);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setLoading(true);
    try {
      const response = await fetch('/api/staff/catering', { cache: 'no-store', signal: request.signal }), body = await response.json();
      if (!response.ok) { if (response.status === 401 && !request.signal.aborted) setData(null); throw new Error(response.status === 401 ? 'Your staff session ended. Sign in again to review catering.' : body.error || 'Unable to load inquiries.'); }
      if (!request.signal.aborted) {
        setData(current => {
          const previous = new Map(current?.leads.map(lead => [lead.id, lead]));
          return { ...body, loadedAt: new Date().toISOString(), leads: body.leads.map((lead: CateringLead) => { const saved = previous.get(lead.id); return saved && saved.version > lead.version ? saved : lead; }) };
        });
        setError('');
      }
    } catch (err) { if (!request.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load inquiries. Please retry.'); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(focus, 60000); window.addEventListener('focus', focus);
    return () => { controller.current?.abort(); window.clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [refresh]);
  const leads = data?.leads || [], timezone = data?.timezone;
  const visible = timezone ? filterCatering(leads, { filter, search, dueOnly, sort }, timezone) : [];
  const due = timezone ? leads.filter(lead => cateringFollowUpDue(lead, timezone)).length : 0;
  const count = (value: CateringFilter) => leads.filter(lead => value === 'all' || (value === 'active' ? !closedCatering(lead.status) : value === 'closed' ? closedCatering(lead.status) : lead.status === value)).length;
  function clearFilters() { setSearch(''); setFilter('active'); setDueOnly(false); }
  return <main className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">Events & gatherings</p><h1 className="text-3xl font-semibold tracking-tight">Catering inquiries</h1><p className="mt-2 text-sm text-muted-foreground">From the first conversation to the day of the event.</p></div>
      <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Refreshing…' : 'Refresh inquiries'}</Button>
    </header>
    <section className="space-y-4 rounded-2xl border bg-card p-4" aria-label="Filter catering inquiries">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1.5" aria-label="Inquiry stages">{filters.map(item => <Button key={item.value} size="sm" variant={filter === item.value ? 'default' : 'ghost'} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}<span className="ml-2 text-xs opacity-70">{count(item.value)}</span></Button>)}</div>
        <Button variant={dueOnly ? 'default' : 'outline'} size="sm" className="gap-2" aria-pressed={dueOnly} onClick={() => { setDueOnly(!dueOnly); setFilter('active'); }}><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Follow-ups due{due > 0 && <span className="rounded-full bg-foreground/10 px-1.5">{due}</span>}</Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Label htmlFor="catering-search" className="sr-only">Search catering inquiries</Label><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="catering-search" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, contact, event or dish…" /></div>
        <div className="flex items-center gap-2"><Label htmlFor="catering-sort" className="text-xs text-muted-foreground">Sort</Label><select id="catering-sort" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm sm:w-44" value={sort} onChange={event => setSort(event.target.value as 'newest' | 'event')}><option value="newest">Newest inquiry</option><option value="event">Upcoming event</option></select></div>
      </div>
    </section>
    {error && <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"><p>{error}</p>{data && <p>Showing the last loaded inquiries. Refresh before making a decision.</p>}<div className="flex gap-3"><Button size="sm" variant="outline" disabled={loading} onClick={refresh}>Retry loading inquiries</Button>{!data && <a href="/login" className="self-center underline">Staff sign in</a>}</div></div>}
    {!data && loading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading catering inquiries…</p> : data && <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p>{visible.length} {visible.length === 1 ? 'inquiry' : 'inquiries'} · Event dates & follow-ups in {timezone}</p><p>Updated {formatBusinessTimestamp(data.loadedAt, timezone)}</p></div>
      {!visible.length ? <section className="rounded-2xl border border-dashed p-10 text-center"><Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="font-medium">{!leads.length ? 'Your catering inbox is ready' : dueOnly ? 'No follow-ups due in this view' : 'No inquiries in this view'}</h2><p className="mt-2 text-sm text-muted-foreground">{!leads.length ? 'Verified customer inquiries will appear here when they arrive.' : 'Try another stage or clear your search.'}</p>{leads.length > 0 && <Button variant="outline" className="mt-4" onClick={clearFilters}>Reset filters</Button>}</section> :
        <ul className="space-y-3" aria-label="Catering inquiries">{visible.map(lead => <li key={lead.id} className="overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/40">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5"><div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-lg font-semibold">{lead.name}</h2><CateringStage status={lead.status} />{cateringFollowUpDue(lead, timezone!) && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Follow-up due</span>}</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />{lead.date ? formatDateForDisplay(lead.date, timezone) : 'Event date needs review'}{lead.time ? ` · ${lead.time}` : ''}</p><p className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />{lead.partySize ? `${lead.partySize} guests` : 'Guest count not provided'}</p>{lead.budget && <p><span className="text-muted-foreground">Budget </span>{lead.budget}</p>}</div>
            <p className="text-sm text-muted-foreground">{[lead.eventType || 'Event type not provided', lead.selectedDishes.length ? `${lead.selectedDishes.length} ${lead.selectedDishes.length === 1 ? 'dish' : 'dishes'} selected` : 'Menu to discuss'].join(' · ')}</p>
            {lead.specialRequests && <p className="line-clamp-2 break-words text-sm text-muted-foreground">{lead.specialRequests}</p>}
            <p className="text-xs text-muted-foreground"><PhoneNumber phone={lead.phone} verified={lead.phoneVerified} />{lead.createdAt && <span className="ml-3">Received {formatBusinessTimestamp(lead.createdAt, timezone)}</span>}</p>
          </div><Button variant="outline" className="shrink-0 gap-2 self-start sm:self-center" onClick={() => setSelected(lead)} aria-label={`Review inquiry from ${lead.name}`}>Review inquiry<ChevronRight aria-hidden="true" className="h-4 w-4" /></Button></div>
        </li>)}</ul>}
    </>}
    {selected && timezone && <CateringDetails key={selected.id} id={selected.id} timezone={timezone} onClose={() => setSelected(null)} onSaved={lead => setData(current => current ? { ...current, leads: current.leads.map(item => item.id === lead.id ? lead : item) } : current)} />}
  </main>;
}
