import crypto from 'node:crypto';

const ENC_PREFIX = 'enc:v1:';

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Returns encrypted wrapper string when secret is set; otherwise returns input as-is.
 */
export function maybeEncryptSubscriptionJson(plainJson: string, secret: string | null): string {
  if (!secret) return plainJson;
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plainJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = JSON.stringify({
    iv: iv.toString('base64'),
    ct: ct.toString('base64'),
    tag: tag.toString('base64'),
  });
  return `${ENC_PREFIX}${Buffer.from(payload, 'utf8').toString('base64')}`;
}

/**
 * Reads encrypted wrapper (`enc:v1:`) when present; falls back to plain text for legacy rows.
 */
export function maybeDecryptSubscriptionJson(stored: string, secret: string | null): string | null {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  if (!secret) return null;
  try {
    const raw = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64').toString('utf8');
    const parsed = JSON.parse(raw) as { iv: string; ct: string; tag: string };
    const key = deriveKey(secret);
    const iv = Buffer.from(parsed.iv, 'base64');
    const ct = Buffer.from(parsed.ct, 'base64');
    const tag = Buffer.from(parsed.tag, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    return plain;
  } catch {
    return null;
  }
}
