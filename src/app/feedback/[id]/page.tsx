'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { feedbackSentiments, type FeedbackSentiment } from '@/lib/reservations/feedbackPolicy';
import { formatReadableDatePST } from '@/utils/dateUtils';
type Visit = { name: string; date: string; time: string; timezone: string; submitted: boolean; stopped: boolean; reviewUrl: string };
const labels = { good: 'Great', neutral: 'Okay', bad: 'Could be better', 'did-not-attend': 'I did not attend' };
export default function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params), { restaurant } = useTimezone();
  const [token, setToken] = useState(''), [visit, setVisit] = useState<Visit | null>(null), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [sentiment, setSentiment] = useState<FeedbackSentiment>('good'), [comment, setComment] = useState(''), [stop, setStop] = useState(false);
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [codeSent, setCodeSent] = useState(false), [codeLength, setCodeLength] = useState(4);
  const load = useCallback(async (access: string) => {
    setLoading(true); setError('');
    try { const response = await fetch('/api/feedback/' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + access }, cache: 'no-store' });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setVisit(data);
    } catch (err) { setVisit(null); setError((err as Error).message || 'Unable to load feedback. Try again.'); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { const access = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''; setToken(access); if (access) void load(access); else setLoading(false); }, [load]);
  async function send(body: unknown) {
    setBusy(true); setError('');
    try { const response = await fetch('/api/feedback/' + encodeURIComponent(id), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setNotice('action' in (body as object) ? 'Future visit feedback emails are stopped for your email address.' : 'Thank you. Your feedback has been sent to the restaurant.'); await load(token);
    } catch (err) { setError((err as Error).message || 'Unable to submit. Try again.'); } finally { setBusy(false); }
  }
  async function recover() {
    setBusy(true); setError('');
    try {
      if (!codeSent) { const response = await fetch('/api/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error); setCodeLength(data.codeLength || 4); setCodeSent(true); return; }
      const verification = await fetch('/api/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) });
      const proof = await verification.json(); if (!verification.ok || !proof.valid) throw new Error(proof.error || 'Incorrect or expired code');
      const response = await fetch('/api/feedback/' + encodeURIComponent(id) + '/recover', { method: 'POST' }), data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const hash = new URL(data.feedbackUrl).hash, access = new URLSearchParams(hash.slice(1)).get('token')!;
      window.history.replaceState(null, '', window.location.pathname + hash); setToken(access); await load(access);
    } catch (err) { setError((err as Error).message || 'Unable to recover access. Call the restaurant.'); } finally { setBusy(false); }
  }
  return <main className="guest-management min-h-screen bg-[#F9F7F2] px-4 py-8 sm:py-14"><div className="mx-auto max-w-xl space-y-6">
    <Link href="/" className="text-xs uppercase tracking-widest text-zinc-600">{restaurant.shortName} · {restaurant.location}</Link>
    <section className="overflow-hidden rounded-[1.75rem] border border-zinc-900/10 bg-white"><header className="bg-[#121212] px-6 py-10 text-center text-[#F9F7F2]"><p className="mb-3 text-xs uppercase tracking-widest text-[#A3B18A]">Your experience</p><h1 className="text-4xl italic" style={{ fontFamily: 'var(--font-editorial), Georgia, serif' }}>How was your visit?</h1></header>
      <div className="space-y-5 p-6 sm:p-8">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        {loading ? <p role="status">Loading your visit…</p> : visit ? <>
          <div className="rounded-2xl bg-[#EAE0D5] p-5"><p>{visit.name}</p><p className="mt-2 text-sm">{formatReadableDatePST(visit.date, visit.timezone)} · {visit.time}</p><p className="mt-2 text-xs">Restaurant local time · {visit.timezone}</p></div>
          {visit.submitted ? <p>Feedback has been recorded for this visit. Thank you for sharing.</p> : <form className="space-y-5" onSubmit={event => { event.preventDefault(); void send({ sentiment, comment, stopFollowUps: stop }); }}>
            <fieldset disabled={busy}><legend className="mb-3 font-medium">How did it go?</legend><div className="grid grid-cols-2 gap-3">{feedbackSentiments.map(value => <label key={value} className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="radio" name="sentiment" checked={sentiment === value} onChange={() => setSentiment(value)} />{labels[value]}</label>)}</div></fieldset>
            <div className="space-y-2"><Label htmlFor="feedback-comment">Anything you would like us to know? (optional)</Label><Textarea id="feedback-comment" disabled={busy} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} rows={4} /></div>
            <p className="text-xs text-zinc-600">Your feedback goes to restaurant staff. Reporting an absence asks staff to review the visit.</p>
            {!visit.stopped && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={stop} onChange={event => setStop(event.target.checked)} disabled={busy} />Stop future visit feedback emails</label>}
            <Button className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</Button>
          </form>}
          {visit.reviewUrl && <p className="text-sm">Prefer to share publicly? <a href={visit.reviewUrl} target="_blank" rel="noopener noreferrer" className="underline">Write a public review</a>.</p>}
          {visit.stopped ? <p className="text-xs text-zinc-600">Visit feedback emails are stopped for your email address.</p> : <Button variant="outline" disabled={busy} onClick={() => send({ action: 'unsubscribe' })}>Stop feedback emails</Button>}
        </> : <div className="space-y-4"><p className="text-sm">Open the secure link from your feedback email, or verify the phone used for this booking.</p>
          {token && <Button variant="outline" disabled={busy} onClick={() => load(token)}>Try loading again</Button>}
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); void recover(); }}><div className="space-y-2"><Label htmlFor="feedback-phone">Booking phone</Label><Input id="feedback-phone" type="tel" autoComplete="tel" required value={phone} disabled={busy} onChange={event => { setPhone(event.target.value); setCodeSent(false); setCode(''); }} /></div>
            {codeSent && <div className="space-y-2"><Label htmlFor="feedback-code">Verification code</Label><Input id="feedback-code" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={codeLength} required minLength={codeLength} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></div>}
            <Button disabled={busy}>{busy ? 'Please wait…' : codeSent ? 'Verify and recover feedback link' : 'Send verification code'}</Button>
          </form></div>}
      </div></section>
    <p className="text-center text-sm text-zinc-600">Need help? <a className="underline" href={'tel:' + restaurant.phone}>{restaurant.phoneLabel}</a></p>
  </div></main>;
}
