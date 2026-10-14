'use client';
import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CONSENT_TEXT, CONSENT_VERSION } from '@/lib/mailing/policy';
export default function EmailSignup({ source, compact = false, onSuccess }: { source: 'banner' | 'modal'; compact?: boolean; onSuccess?: () => void }) {
  const id = useId(), [email, setEmail] = useState(''), [consent, setConsent] = useState(false), [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/mailing/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, consent, consentVersion: CONSENT_VERSION, source, website }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to sign up. Please try again.');
      setMessage(result.message); setEmail(''); setConsent(false); onSuccess?.();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to sign up. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className={compact ? 'w-full max-w-lg text-left' : 'space-y-4 text-left'} aria-label={compact ? 'Monthly offers signup in banner' : 'Monthly offers signup in promotion'}>
    {message ? <p role="status" className="rounded-xl border border-[#526341]/30 bg-[#edf1e8] p-3 text-sm text-[#344529]">{message}</p> : <>
      <label htmlFor={`${id}-email`} className={compact ? 'sr-only' : 'mb-2 block text-sm font-medium text-zinc-800'}>Email address</label>
      <div className="flex gap-2">
        <input id={`${id}-email`} type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} placeholder="Your email address" className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#526341]" />
        <button disabled={busy} className="shrink-0 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60">{busy ? 'Sending…' : 'Sign me up'}</button>
      </div>
      <label className={`flex items-start gap-2 text-xs text-zinc-700 ${compact ? 'mt-2 leading-4' : 'leading-5'}`}>
        <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required disabled={busy} className="mt-0.5 h-4 w-4 shrink-0 accent-[#526341]" />
        <span>{CONSENT_TEXT} <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Privacy notice</Link>.</span>
      </label>
      <div className="absolute -left-[10000px]" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label></div>
      {!compact && <p className="text-xs leading-5 text-zinc-500">We’ll email a confirmation link first. Signing up is optional and doesn’t affect your reservation.</p>}
    </>}
    {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
  </form>;
}
