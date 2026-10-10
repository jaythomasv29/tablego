'use client';
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useTimezone } from '@/contexts/TimezoneContext';
import { getLocalDateString, formatDateForDisplay } from '@/utils/dateUtils';
interface Data { pageViews: { value: number }; dailyViews: { date: string; views: number }[]; menuDownloads: number; pendingCatering: number }
export default function InsightsPage() {
  const { timezone, loading: timezoneLoading, error: timezoneError } = useTimezone(), [data, setData] = useState<Data | null>(null), [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); fetch('/api/analytics', { cache: 'no-store', signal: controller.signal }).then(async response => {
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load insights'); setData(body);
  }).catch(err => { if (!controller.signal.aborted) setError(err.message); }); return () => controller.abort(); }, []);
  const days = new Map<string, number>();
  for (const row of !timezoneLoading && !timezoneError ? data?.dailyViews || [] : []) { const date = getLocalDateString(row.date, timezone); days.set(date, (days.get(date) || 0) + row.views); }
  return <AdminLayout><div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8"><h1 className="text-3xl font-semibold">Guest engagement insights</h1><p className="text-sm text-muted-foreground">Recent website activity grouped in {timezone}. Booking service is on Today.</p>{error || timezoneError ? <p role="alert">{error || timezoneError}</p> : !data || timezoneLoading ? <p role="status">Loading insights…</p> : <><div className="grid gap-4 sm:grid-cols-3">{[['Page views · last 7 days', data.pageViews.value], ['Menu downloads · all time', data.menuDownloads], ['Pending catering requests', data.pendingCatering]].map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}</div><table className="w-full text-left text-sm"><caption className="py-3 text-left font-semibold">Page views by restaurant calendar date</caption><thead><tr><th className="border-b py-2">Date</th><th className="border-b py-2">Views</th></tr></thead><tbody>{Array.from(days.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([date, views]) => <tr key={date}><td className="border-b py-2">{formatDateForDisplay(date)}</td><td className="border-b py-2">{views}</td></tr>)}</tbody></table>{!days.size && <p>No page views recorded during the last seven days.</p>}</>}</div></AdminLayout>;
}
