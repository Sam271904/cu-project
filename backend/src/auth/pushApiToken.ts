import crypto from 'node:crypto';
import type http from 'node:http';

/**
 * Task 2.2 auth-lite: when `PIH_PUSH_API_TOKEN` is set, mutating push endpoints require
 * `Authorization: Bearer <token>` or `X-PIH-Token: <token>`.
 */
export function extractPushApiToken(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    const t = auth.slice(7).trim();
    return t.length ? t : null;
  }

  const raw = req.headers['x-pih-token'];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0] && String(raw[0]).trim()) return String(raw[0]).trim();

  return null;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** If `expectedToken` is null/empty, authorization is not required (local dev default). */
export function isPushApiAuthorized(req: http.IncomingMessage, expectedToken: string | null): boolean {
  if (expectedToken === null || expectedToken === '') return true;
  const got = extractPushApiToken(req);
  if (got === null) return false;
  return timingSafeEqualString(got, expectedToken);
}
