'use client';

import { useEffect, useState } from 'react';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '@/firebase';

export default function AdminAuthBoundary({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function connect() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (response.status === 401) {
          await signOut(auth);
          window.location.assign(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        if (!response.ok) throw new Error('Session verification failed');
        const data = await response.json();
        await signInWithCustomToken(auth, data.firebaseToken);
        if (!active) return;
        setReady(true);
        // Browser timers overflow after about 24.8 days; recheck long sessions daily.
        const checkExpiry = () => {
          if (!active) return;
          const remaining = data.expiresAt * 1000 - Date.now();
          if (remaining <= 0) {
            void signOut(auth);
            window.location.assign('/login');
            return;
          }
          timer = setTimeout(checkExpiry, Math.min(remaining, 24 * 60 * 60 * 1000));
        };
        checkExpiry();
      } catch {
        if (active) setFailed(true);
      }
    }
    void connect();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, []);
  if (!ready) return <div className="p-8 text-center" role="status">
    {failed ? 'Unable to verify staff access. Please reload to try again.' : 'Checking staff access…'}
  </div>;
  return children;
}
