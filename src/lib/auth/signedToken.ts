export type TokenKind = 'admin' | 'phone';
export interface SignedClaims {
  version: 1;
  kind: TokenKind;
  expiresAt: number;
  id: string;
  data: Record<string, string>;
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

async function signingKey(secret: string) {
  if (secret.length < 32) throw new Error('ADMIN_SESSION_SECRET must contain at least 32 characters');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function issueSignedToken(kind: TokenKind, data: Record<string, string>, ttlSeconds: number,
  secret = process.env.ADMIN_SESSION_SECRET || '', now = Date.now()) {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) throw new Error('Invalid token lifetime');
  const claims: SignedClaims = { version: 1, kind, expiresAt: Math.floor(now / 1000) + ttlSeconds, id: crypto.randomUUID(), data };
  const encoded = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), new TextEncoder().encode(encoded));
  return { token: `${encoded}.${base64url(new Uint8Array(signature))}`, claims };
}

export async function verifySignedToken(token: string | undefined, kind: TokenKind,
  secret = process.env.ADMIN_SESSION_SECRET || '', now = Date.now()): Promise<SignedClaims | null> {
  try {
    if (!token || token.length > 4096 || secret.length < 32) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
    if (!await crypto.subtle.verify('HMAC', await signingKey(secret), decode(parts[1]), new TextEncoder().encode(parts[0]))) return null;
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (claims.version !== 1 || claims.kind !== kind || !Number.isInteger(claims.expiresAt) ||
      claims.expiresAt <= Math.floor(now / 1000) || typeof claims.id !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(claims.id) || !claims.data || typeof claims.data !== 'object' || Array.isArray(claims.data)) return null;
    if (!Object.values(claims.data).every(value => typeof value === 'string')) return null;
    return claims;
  } catch {
    return null;
  }
}
