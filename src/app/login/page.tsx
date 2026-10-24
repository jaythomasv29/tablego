"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Delete } from 'lucide-react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/firebase';

function LoginForm() {
  const [mode, setMode] = useState<'pin' | 'password'>('pin');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCallback = searchParams.get('callbackUrl') || '';
  const callbackUrl = requestedCallback.startsWith('/admin/') || requestedCallback === '/admin' ? requestedCallback : '/admin/home';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || (mode === 'pin' && pin.length !== 4)) return;
    submitting.current = true;
    setError(''); setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'pin' ? { pin, remember } : { username, password, remember }),
      });
      if (response.ok) {
        const data = await response.json();
        await signInWithCustomToken(auth, data.firebaseToken);
        router.push(callbackUrl);
      } else {
        setError(response.status === 401
          ? mode === 'pin' ? 'That code didn’t match. Enter the last 4 digits of the restaurant telephone number.' : 'Incorrect username or password.'
          : response.status === 429 ? 'Too many sign-in attempts. Please try again in 15 minutes.'
            : 'Sign-in is temporarily unavailable. Please try again shortly.');
      }
    } catch {
      setError('Unable to finish signing in. Please check your connection and try again.');
    } finally {
      submitting.current = false; setLoading(false);
    }
  }
  function editPin(value: string) { setPin(value.replace(/\D/g, '').slice(0, 4)); setError(''); }

  return <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
    <div className="space-y-2 text-center"><h1 className="text-2xl font-bold tracking-tight">Staff sign in</h1><p id="login-instructions" className="text-sm text-muted-foreground">{mode === 'pin' ? 'Enter the last 4 digits of the restaurant telephone number.' : 'Enter your admin username and password.'}</p></div>
    <form className="space-y-4" onSubmit={handleSubmit}>
      {mode === 'pin' ? <div className="space-y-4">
        <Label htmlFor="pin" className="sr-only">4-digit restaurant code</Label>
        <Input id="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={pin} disabled={loading}
          aria-describedby={`login-instructions${error ? ' login-error' : ''}`} aria-invalid={Boolean(error)}
          onChange={event => editPin(event.target.value)} className="h-16 text-center text-3xl tracking-[0.6em]" placeholder="••••" />
        <div className="grid grid-cols-3 gap-3" role="group" aria-label="Number pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => <Button key={digit} type="button" variant="outline" className="h-16 touch-manipulation text-2xl" disabled={loading || pin.length === 4} onClick={() => editPin(pin + digit)}>{digit}</Button>)}
          <Button type="button" variant="outline" className="h-16 touch-manipulation" disabled={loading || !pin} onClick={() => editPin('')}>Clear</Button>
          <Button type="button" variant="outline" className="h-16 touch-manipulation text-2xl" disabled={loading || pin.length === 4} onClick={() => editPin(pin + '0')}>0</Button>
          <Button type="button" variant="outline" className="h-16 touch-manipulation" aria-label="Delete last digit" disabled={loading || !pin} onClick={() => editPin(pin.slice(0, -1))}><Delete className="h-6 w-6" aria-hidden="true" /></Button>
        </div>
      </div> : <>
        <div className="space-y-1.5"><Label htmlFor="username">Username</Label><Input id="username" autoComplete="username" value={username} required disabled={loading} aria-describedby={error ? 'login-error' : undefined} onChange={event => { setUsername(event.target.value); setError(''); }} /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" value={password} required disabled={loading} aria-describedby={error ? 'login-error' : undefined} onChange={event => { setPassword(event.target.value); setError(''); }} /></div>
      </>}
      {error && <p id="login-error" role="alert" className="text-sm text-destructive">{error}</p>}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-muted-foreground"><input type="checkbox" checked={remember} disabled={loading} onChange={event => setRemember(event.target.checked)} className="h-5 w-5 accent-primary" />Remember this device for up to 400 days</label>
      <Button type="submit" className="h-12 w-full text-base" disabled={loading || (mode === 'pin' && pin.length !== 4)}>{loading ? 'Signing in…' : 'Sign in'}</Button>
    </form>
    <Button type="button" variant="ghost" className="min-h-11 w-full" disabled={loading} onClick={() => { setMode(mode === 'pin' ? 'password' : 'pin'); setError(''); setPin(''); setPassword(''); }}>{mode === 'pin' ? 'Use username and password' : 'Use number pad'}</Button>
  </div>;
}
export default function LoginPage() {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8"><Suspense fallback={<p role="status">Loading sign in…</p>}><LoginForm /></Suspense></div>;
}
