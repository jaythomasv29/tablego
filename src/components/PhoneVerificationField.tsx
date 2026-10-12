'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PhoneVerifiedBadge } from './PhoneNumber';

type Props = { phone: string; verified: boolean; onChange: (phone: string) => void; onVerified: (verified: boolean) => void; disabled?: boolean };
const inputClass = 'w-full rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#A3B18A] disabled:opacity-60';

export default function PhoneVerificationField({ phone, verified, onChange, onVerified, disabled = false }: Props) {
  const id = useId(), attempt = useRef(0), currentPhone = useRef(phone), previousPhone = useRef(phone), verificationCallback = useRef(onVerified);
  currentPhone.current = phone; verificationCallback.current = onVerified;
  const [sent, setSent] = useState(false), [code, setCode] = useState(''), [length, setLength] = useState(4);
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null), [error, setError] = useState('');
  const digits = phone.replace(/\D/g, ''), ready = /^[\d+()\s.-]+$/.test(phone) && (digits.length === 10 || (digits.length === 11 && digits.startsWith('1')));

  useEffect(() => {
    if (previousPhone.current === phone) return;
    previousPhone.current = phone; attempt.current++;
    setSent(false); setCode(''); setBusy(null); setError(''); verificationCallback.current(false);
  }, [phone]);
  useEffect(() => () => { attempt.current++; }, []);

  async function requestCode() {
    if (!ready || busy || disabled) return;
    const requestId = ++attempt.current, target = phone;
    setBusy('send'); setError(''); setCode('');
    try {
      const response = await fetch('/api/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: target }) });
      const data = await response.json();
      if (requestId !== attempt.current || currentPhone.current !== target) return;
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not send a code. Please try again.');
      if (!Number.isInteger(data.codeLength) || data.codeLength < 4 || data.codeLength > 10) throw new Error('Could not send a code. Please try again.');
      setLength(data.codeLength); setSent(true);
    } catch (error) {
      if (requestId === attempt.current) setError(error instanceof Error ? error.message : 'Could not send a code. Please try again.');
    } finally { if (requestId === attempt.current) setBusy(null); }
  }

  async function verifyCode() {
    if (!sent || code.length !== length || busy || disabled) return;
    const requestId = ++attempt.current, target = phone;
    setBusy('verify'); setError('');
    try {
      const response = await fetch('/api/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: target, code }) });
      const data = await response.json();
      if (requestId !== attempt.current || currentPhone.current !== target) return;
      if (!response.ok || data.success !== true || data.valid !== true) throw new Error(data.error || 'Incorrect code. Try again or request a new code.');
      verificationCallback.current(true); setSent(false); setCode('');
    } catch (error) {
      if (requestId === attempt.current) { setError(error instanceof Error ? error.message : 'Verification failed. Please try again.'); setCode(''); }
    } finally { if (requestId === attempt.current) setBusy(null); }
  }

  return <div className="space-y-2">
    <label htmlFor={`${id}-phone`} className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Phone number (US)</label>
    <div className="flex flex-wrap items-center gap-2"><input id={`${id}-phone`} type="tel" name="phone" autoComplete="tel" maxLength={40} required
      value={phone} onChange={event => { verificationCallback.current(false); onChange(event.target.value); }} disabled={disabled || Boolean(busy)}
      placeholder="(650) 000-0000" className={`${inputClass} min-w-0 flex-1`} /><PhoneVerifiedBadge verified={verified} /></div>
    {verified && <p role="status" className="sr-only">Phone number verified.</p>}
    {!verified && <div className="space-y-2 rounded-xl border border-[#A3B18A]/40 bg-[#A3B18A]/10 p-3">
      <p className="text-xs leading-relaxed text-zinc-600">{sent ? `Enter the ${length}-digit code sent to ${phone}.` : 'Verify this number by text before sending your inquiry. Message and data rates may apply.'}</p>
      {sent && <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1"><label htmlFor={`${id}-code`} className="sr-only">Verification code</label><input id={`${id}-code`} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={length}
          value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, length))} disabled={disabled || Boolean(busy)} placeholder={`${length}-digit code`} className={inputClass} /></div>
        <button type="button" onClick={verifyCode} disabled={disabled || Boolean(busy) || code.length !== length} className="flex h-11 items-center gap-1.5 rounded-xl bg-[#A3B18A] px-4 text-sm font-medium text-zinc-900 disabled:opacity-50">{busy === 'verify' && <Loader2 className="h-4 w-4 animate-spin" />}{busy === 'verify' ? 'Verifying…' : 'Verify code'}</button>
      </div>}
      <button type="button" onClick={requestCode} disabled={!ready || disabled || Boolean(busy)} className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 underline underline-offset-2 disabled:opacity-40">{busy === 'send' && <Loader2 className="h-3 w-3 animate-spin" />}{busy === 'send' ? 'Sending…' : sent ? 'Resend code' : 'Send code'}</button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>}
  </div>;
}
