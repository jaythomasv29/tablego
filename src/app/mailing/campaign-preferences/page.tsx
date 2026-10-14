'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
export default function CampaignPreferences() {
  const [token, setToken] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') || ''); }, []);
  async function unsubscribe() {
    setBusy(true); setStatus('');
    try { const response = await fetch('/api/campaigns/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to update preferences.'); setDone(true); window.history.replaceState(null, '', window.location.pathname); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Please try again.'); } finally { setBusy(false); }
  }
  return <main className="guest-management flex min-h-screen items-center justify-center bg-[#F9F7F2] p-5"><section className="w-full max-w-lg space-y-5 rounded-3xl border bg-white p-8 text-zinc-800"><p className="text-xs uppercase tracking-widest text-[#526341]">Thaiphoon · Email preferences</p><h1 className="font-serif text-3xl">{done ? 'You’re unsubscribed.' : 'Your inbox, your choice.'}</h1><p className="text-sm leading-7">{done ? 'Your promotional email preference has been recorded. You will not receive further campaign touchpoints. Reservation and catering service messages can still reach you.' : 'Stop promotional campaign emails without logging in. Any email already being sent may still arrive.'}</p>{!done && <button disabled={!token || busy} onClick={unsubscribe} className="rounded-full bg-[#A3B18A] px-6 py-3 font-medium disabled:opacity-50">{busy ? 'Updating…' : 'Unsubscribe'}</button>}{!token && !done && <p className="text-sm">Open the unsubscribe link from your email.</p>}{status && <p role="alert" className="text-sm text-red-700">{status}</p>}<p><Link className="text-sm underline" href="/">Return to restaurant</Link> · <Link className="text-sm underline" href="/privacy">Privacy</Link></p></section></main>;
}
