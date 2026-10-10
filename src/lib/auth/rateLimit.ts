import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerDatabase } from '../serverFirebase';
// Shared transactional limits survive process restarts and concurrent instances.
export async function rateLimit(scope: string, identity: string, limit: number, windowSeconds: number): Promise<NextResponse | null> {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error('Missing server secret');
    const ref = getServerDatabase().doc(`requestLimits/${createHmac('sha256', secret).update(`${scope}:${identity}`).digest('hex')}`);
    const now = Date.now();
    const allowed = await getServerDatabase().runTransaction(async tx => {
      const record = (await tx.get(ref)).data();
      const reset = !record || record.resetAt <= now;
      if (!reset && record.count >= limit) return false;
      tx.set(ref, { count: reset ? 1 : record.count + 1, resetAt: reset ? now + windowSeconds * 1000 : record.resetAt, expiresAt: new Date(now + windowSeconds * 2000) });
      return true;
    });
    return allowed ? null : NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(windowSeconds) } });
  } catch {
    return NextResponse.json({ error: 'Unable to verify request limits. Please try again.' }, { status: 503 });
  }
}
