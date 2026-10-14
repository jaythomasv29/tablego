'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { useTimezone } from '@/contexts/TimezoneContext';
export default function MailingPreferences() {
  const { restaurant } = useTimezone(), [link, setLink] = useState<{ id: string; token: string; action: string } | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const readLink = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1)), id = fragment.get('id'), token = fragment.get('token'), action = fragment.get('action');
      setLink(id && token && (action === 'confirm' || action === 'unsubscribe') ? { id, token, action } : null);
      setDone(false); setError(''); setReady(true);
    };
    readLink(); window.addEventListener('hashchange', readLink);
    return () => window.removeEventListener('hashchange', readLink);
  }, []);
  async function apply() {
    if (!link || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/mailing/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(link) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to save your preference.'); setDone(true);
      window.history.replaceState(null, '', window.location.pathname);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to save your preference.'); }
    finally { setBusy(false); }
  }
  const confirming = link?.action === 'confirm';
  return <main className="guest-management flex min-h-[100dvh] items-center justify-center bg-[#F9F7F2] p-5"><section className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-10">
    <p className="mb-6 text-xs uppercase tracking-[0.22em] text-[#526341]">{restaurant.name}</p><MailCheck className="mb-5 h-9 w-9 text-[#526341]" />
    <h1 className="font-serif text-3xl" style={{ fontFamily: 'var(--font-display), Georgia, serif' }}>{!ready ? 'Loading your link…' : done ? confirming ? 'You’re on the list.' : 'You’re unsubscribed.' : link ? confirming ? 'Let’s make it official.' : 'Unsubscribe from promotions?' : 'Your email preferences'}</h1>
    <p className="my-5 text-sm leading-6 text-zinc-600">{done ? confirming ? 'Look forward to monthly promotions and special offers. You can unsubscribe anytime.' : 'You will no longer receive promotional emails. Reservation and catering messages about your requests will continue.' : link ? confirming ? 'Confirm that you’d like to receive promotional emails from Thaiphoon Restaurant.' : 'One click below stops promotional emails. No account or login is needed.' : 'Open the confirmation or unsubscribe link in your email. For help with your preferences, contact the restaurant below.'}</p>
    {link && !done && <button onClick={apply} disabled={busy} className="w-full rounded-full bg-[#A3B18A] px-5 py-3 font-semibold text-zinc-900 disabled:opacity-60">{busy ? 'Saving…' : confirming ? 'Confirm my subscription' : 'Unsubscribe'}</button>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-7 flex flex-wrap gap-4 text-sm text-zinc-600"><Link href="/" className="underline">Back to Thaiphoon</Link><Link href="/privacy" className="underline">Privacy notice</Link><a className="underline" href={`mailto:${restaurant.email}?subject=Email%20preferences`}>Contact us</a></div>
    <p className="mt-6 text-xs text-zinc-500">{restaurant.address}</p>
  </section></main>;
}
