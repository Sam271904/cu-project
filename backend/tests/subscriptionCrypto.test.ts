import { describe, expect, it } from 'vitest';
import {
  maybeDecryptSubscriptionJson,
  maybeEncryptSubscriptionJson,
} from '../src/services/push/subscriptionCrypto';

describe('subscriptionCrypto (Task 8.1 Step 2)', () => {
  it('returns plain text when secret is null', () => {
    const plain = '{"endpoint":"https://example.com/a"}';
    expect(maybeEncryptSubscriptionJson(plain, null)).toBe(plain);
    expect(maybeDecryptSubscriptionJson(plain, null)).toBe(plain);
  });

  it('encrypts and decrypts roundtrip when secret is set', () => {
    const plain = '{"endpoint":"https://example.com/a","keys":{"p256dh":"x","auth":"y"}}';
    const secret = 'my-subscription-secret';
    const enc = maybeEncryptSubscriptionJson(plain, secret);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc.includes('https://example.com/a')).toBe(false);

    const dec = maybeDecryptSubscriptionJson(enc, secret);
    expect(dec).toBe(plain);
  });

  it('fails to decrypt when secret is missing/mismatched', () => {
    const plain = '{"endpoint":"https://example.com/a"}';
    const enc = maybeEncryptSubscriptionJson(plain, 's1');
    expect(maybeDecryptSubscriptionJson(enc, null)).toBeNull();
    expect(maybeDecryptSubscriptionJson(enc, 's2')).toBeNull();
  });
});
