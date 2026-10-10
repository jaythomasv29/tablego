import { NextResponse } from 'next/server';
import { getServerAuth, getServerDatabase } from '@/lib/serverFirebase';
import { verifySignedToken, type SignedClaims } from './signedToken';

export function readCookie(request: Request, name: string): string | undefined {
  return request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function validMutationOrigin(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  const expected = new URL(request.url);
  expected.host = request.headers.get('host') || expected.host;
  return !origin || origin === expected.origin;
}

export async function adminSession(request: Request): Promise<SignedClaims | null> {
  const session = await verifySignedToken(readCookie(request, 'company-auth'), 'admin');
  if (!session) return null;
  const record = await getServerDatabase().doc(`staffSessions/${session.id}`).get();
  return record.exists && record.data()?.active === true && record.data()?.expiresAt === session.expiresAt ? session : null;
}

export async function requireAdmin(request: Request): Promise<NextResponse | null> {
  if (request.method !== 'GET' && !validMutationOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  try {
    return await adminSession(request) ? null : NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Unable to verify staff access' }, { status: 503 });
  }
}

export async function staffFirebaseToken(session: SignedClaims) {
  return getServerAuth().createCustomToken(`staff-${session.id}`, {
    admin: true, sessionId: session.id, sessionExpiresAt: session.expiresAt,
  });
}

export function secureCookie(request: Request): boolean {
  return new URL(request.url).protocol === 'https:' ||
    (process.env.NODE_ENV === 'production' && process.env.TABLEGO_ENVIRONMENT !== 'staging');
}
