'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download, Mail, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useTimezone } from '@/contexts/TimezoneContext';
import { statusLabels, type MailingContact, type MailingStatus } from '@/lib/mailing/policy';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
type Counts = { total: number; subscribed: number; pending: number; unsubscribed: number; contact: number };
export default function MailingList() {
  const { timezone } = useTimezone(), [contacts, setContacts] = useState<MailingContact[]>([]), [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [filter, setFilter] = useState<MailingStatus | 'all'>('all'), [search, setSearch] = useState(''), [page, setPage] = useState(1), [busy, setBusy] = useState(''), [confirm, setConfirm] = useState<MailingContact | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/staff/mailing', { cache: 'no-store' }), data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load mailing list.');
      setContacts(data.contacts); setCounts(data.counts); window.dispatchEvent(new CustomEvent('tablego-mailing-updated', { detail: data.counts.total }));
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to load mailing list.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function unsubscribe() {
    if (!confirm || busy) return;
    setBusy(confirm.id); setError('');
    try {
      const response = await fetch('/api/staff/mailing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsubscribe', id: confirm.id, version: confirm.version }) }), data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to unsubscribe.'); setConfirm(null); await refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to unsubscribe.'); }
    finally { setBusy(''); }
  }
  async function exportSubscribers() {
    setBusy('export'); setError('');
    try {
      const response = await fetch('/api/staff/mailing/export', { method: 'POST' });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Unable to export subscribers.'); }
      const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'thaiphoon-subscribers.csv'; anchor.click(); URL.revokeObjectURL(url);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to export subscribers.'); }
    finally { setBusy(''); }
  }
  const matches = contacts.filter(contact => (filter === 'all' || contact.status === filter) && contact.email.includes(search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(matches.length / 25)), currentPage = Math.min(page, pages);
  const format = (value: string) => value ? new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><Mail className="h-4 w-4" />Guest engagement</p><h1 className="text-3xl font-semibold">Mailing list <span className="ml-1 inline-flex rounded-full bg-muted px-3 py-1 align-middle text-lg" aria-label={`${counts?.total ?? 0} unique email contacts`}>{counts?.total ?? '…'}</span></h1><p className="mt-2 text-sm text-muted-foreground">A clear view of your contacts, with their email choices respected.</p></div><button onClick={refresh} disabled={loading || Boolean(busy)} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{(['subscribed', 'pending', 'unsubscribed', 'contact'] as const).map(status => <button key={status} onClick={() => { setFilter(status); setPage(1); }} aria-pressed={filter === status} className={`rounded-2xl border p-4 text-left ${filter === status ? 'border-[#A3B18A] bg-[#A3B18A]/15' : 'border-border bg-card'}`}><p className="text-2xl font-semibold">{counts?.[status] ?? '…'}</p><p className="mt-1 text-xs text-muted-foreground">{statusLabels[status]}</p></button>)}</div>
    <div className="flex gap-3 rounded-2xl border border-border bg-card p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#718754]" /><div><p className="font-medium">Contacts aren’t automatically subscribers.</p><p className="mt-1 leading-6 text-muted-foreground">The badge counts unique valid emails from reservations, catering, and signups. Only confirmed, explicit opt-ins are included in subscriber exports. Staff can unsubscribe someone, but cannot opt them in.</p></div></div>
    <div className="flex flex-wrap items-center gap-3"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Search contacts by email" placeholder="Search email addresses" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm" /></label><select aria-label="Filter email status" value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(1); }} className="max-w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm"><option value="all">All contacts</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button onClick={exportSubscribers} disabled={Boolean(busy) || loading || !counts?.subscribed} className="flex items-center gap-2 rounded-full bg-[#A3B18A] px-4 py-2.5 text-sm font-semibold text-zinc-900 disabled:opacity-50"><Download className="h-4 w-4" />{busy === 'export' ? 'Exporting…' : 'Export subscribers'}</button></div>
    <p className="text-xs leading-5 text-muted-foreground">Exports contain personal information and individual unsubscribe links. Keep them private, refresh before every campaign, and sync opt-outs with your email provider. Use the restaurant’s sender details and postal address in every campaign; do not send promotions to the other contact groups.</p>
    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</p>}
    <Dialog open={Boolean(confirm)} onOpenChange={open => { if (!open && !busy) setConfirm(null); }}><DialogContent><DialogTitle>Unsubscribe this contact?</DialogTitle><DialogDescription className="break-all">Stop promotional emails for {confirm?.email}? Their reservation and catering records will stay.</DialogDescription>{error && <p role="alert" className="text-sm text-red-500">{error}</p>}<div className="mt-2 flex flex-wrap gap-3"><button disabled={Boolean(busy)} onClick={unsubscribe} className="rounded-full bg-[#A3B18A] px-4 py-2 text-sm font-semibold text-zinc-900">{busy ? 'Saving…' : 'Yes, unsubscribe'}</button><button disabled={Boolean(busy)} onClick={() => setConfirm(null)} className="px-3 py-2 text-sm underline">Keep current preference</button></div></DialogContent></Dialog>
    <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-label="Email contacts">
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground lg:grid"><span>Email</span><span>Collected from</span><span>Email status</span><span>Consent date</span><span className="w-24">Preference</span></div>
      {loading && !counts ? <p role="status" className="p-6 text-sm text-muted-foreground">Loading contacts…</p> : matches.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No contacts match this view.</p> : matches.slice((currentPage - 1) * 25, currentPage * 25).map(contact => <article key={contact.id} className="grid items-center gap-3 border-b border-border p-5 last:border-b-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:gap-4"><p className="break-all text-sm font-medium">{contact.email}</p><p className="text-xs leading-5 text-muted-foreground">{contact.sources.join(' · ')}</p><p><span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${contact.status === 'subscribed' ? 'bg-[#A3B18A]/25 text-foreground' : 'bg-muted text-muted-foreground'}`}>{statusLabels[contact.status]}</span></p><p className="text-xs text-muted-foreground" title={contact.consentVersion ? `Consent version ${contact.consentVersion} · ${timezone}` : undefined}>{format(contact.confirmedAt)}</p><div className="w-24">{(contact.status === 'subscribed' || contact.status === 'pending') && <button disabled={Boolean(busy)} onClick={() => setConfirm(contact)} className="py-1 text-xs underline disabled:opacity-50">Unsubscribe</button>}</div></article>)}
    </section>
    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><p>{matches.length} matching contacts · Dates in {timezone}</p><div className="flex items-center gap-4"><button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="py-2 disabled:opacity-40">Previous</button><span>Page {currentPage} of {pages}</span><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} className="py-2 disabled:opacity-40">Next</button></div></footer>
  </div>;
}
