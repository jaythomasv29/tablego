'use client';
import { useRef, useState } from 'react';
import { Mail, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatReadableDatePST } from '@/utils/dateUtils';

export default function ShareReservation({ id, token, date, time, guests, timezone, disabled, preview = false, onQueued }: {
  id: string; token: string; date: string; time: string; guests: number; timezone: string; disabled: boolean; preview?: boolean; onQueued: (message: string) => void;
}) {
  const [open, setOpen] = useState(false), [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false), submission = useRef<{ email: string; key: string; context: string } | null>(null);
  async function send() {
    if (submitting.current || disabled) return;
    submitting.current = true; setBusy(true); setError('');
    const recipient = email.trim().toLowerCase();
    const context = JSON.stringify([id, date, time, guests]);
    try {
      if (submission.current?.email !== recipient || submission.current.context !== context) submission.current = { email: recipient, key: crypto.randomUUID(), context };
      const response = await fetch(`/api/reservations/${encodeURIComponent(id)}/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': submission.current.key },
        body: JSON.stringify({ email: recipient }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) submission.current = null;
        throw new Error(data.error || 'Unable to queue this invitation. Please try again.');
      }
      onQueued(`Invitation queued for ${recipient}. ${preview ? 'Staging preview: no live email will be sent.' : 'Sharing keeps your reservation and party size the same.'}`);
      setOpen(false); setEmail(''); submission.current = null;
    } catch (err) { setError((err as Error).message || 'Unable to queue this invitation. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <>
    <section aria-label="Share your reservation" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#A3B18A]/40 bg-[#F9F7F2] p-5">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#A3B18A]/20 text-[#586747]"><Mail className="h-4 w-4" aria-hidden="true" /></span>
        <div><h2 className="text-lg italic" style={{ fontFamily: 'var(--font-editorial), Georgia, serif' }}>Good company, all the details.</h2><p className="mt-1 text-xs text-zinc-600">Send a styled invitation to someone joining you.</p></div>
      </div>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => { setError(''); setOpen(true); }}>Share by email <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" /></Button>
    </section>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="guest-management reservation-management rounded-2xl" showCloseButton={!busy}>
      <DialogTitle className="text-2xl font-normal italic" style={{ fontFamily: 'var(--font-editorial), Georgia, serif' }}>Invite your company.</DialogTitle>
      <DialogDescription>Email the reservation details and restaurant address to someone in your party. Your private requests and management link stay with you.</DialogDescription>
      {preview && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">Staging preview: invitations are captured for testing. No live email will be sent.</p>}
      <p className="rounded-xl bg-[#EAE0D5] p-4 text-sm leading-relaxed">{formatReadableDatePST(date, timezone)}<br />{time} · {guests} {guests === 1 ? 'guest' : 'guests'} in your reserved party<br /><span className="text-xs text-zinc-600">Restaurant local time · {timezone}</span></p>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void send(); }}>
        <div className="space-y-2"><Label htmlFor="share-recipient">Their email address</Label><Input id="share-recipient" type="email" inputMode="email" autoComplete="off" placeholder="friend@example.com" required maxLength={254} value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setError(''); }} /></div>
        <p className="text-xs leading-relaxed text-zinc-600">Sharing does not add guests or change the booking. Send only to someone expecting these details.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || disabled}>{busy ? 'Queuing invitation…' : 'Send invitation'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Close</Button></div>
      </form>
    </DialogContent></Dialog>
  </>;
}
