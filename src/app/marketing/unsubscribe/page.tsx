'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
function Unsubscribe() {
  const params = useSearchParams();
  const [done, setDone] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function unsubscribe() {
    setBusy(true); setError('');
    try {
      const query = new URLSearchParams({ key: params.get('key') || '', token: params.get('token') || '' });
      const response = await fetch(`/api/marketing/unsubscribe?${query}`, { method: 'POST' });
      if (!response.ok) throw new Error('Unable to unsubscribe. Please check the link or contact the restaurant.');
      setDone(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-lg space-y-5 p-8"><h1 className="text-2xl font-semibold">{done ? 'You’re unsubscribed' : 'Restaurant email preferences'}</h1><p>{done ? 'You will no longer receive reservation or catering marketing emails. Booking confirmations and service messages will continue.' : 'Unsubscribe from all reservation and catering marketing emails from the restaurant.'}</p>{!done && <Button onClick={unsubscribe} disabled={busy}>{busy ? 'Saving…' : 'Unsubscribe'}</Button>}{error && <p role="alert">{error}</p>}</main>;
}
export default function Page() { return <Suspense fallback={<p role="status">Loading preferences…</p>}><Unsubscribe /></Suspense>; }
