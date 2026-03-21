import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../src/server';
import { openDb } from '../src/db/db';

function requestJson<T = unknown>(opts: {
  hostname: string;
  port: number;
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<{ status: number; body: T | null }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    let bodyBuffer: Buffer | undefined;
    if (opts.body !== undefined) {
      bodyBuffer = Buffer.from(JSON.stringify(opts.body), 'utf-8');
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json; charset=utf-8';
      headers['Content-Length'] = String(bodyBuffer.length);
    }

    const req = http.request(
      {
        hostname: opts.hostname,
        port: opts.port,
        path: opts.path,
        method: opts.method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf-8');
          let parsed: T | null = null;
          if (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('[')) {
            try {
              parsed = JSON.parse(bodyText) as T;
            } catch {
              parsed = null;
            }
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );

    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

describe('Task 2.2 push auth-lite (PIH_PUSH_API_TOKEN)', () => {
  let server: ReturnType<typeof createServer>;
  let port = 0;
  let dbPath = '';
  let db: ReturnType<typeof openDb>;
  const token = 'test-push-api-token-xyz';

  beforeAll(async () => {
    dbPath = path.join(os.tmpdir(), `e-cu-push-auth-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env.DATABASE_URL = `sqlite:${dbPath}`;
    process.env.PIH_PUSH_ENABLED = 'true';
    process.env.PIH_PUSH_API_TOKEN = token;
    process.env.PIH_PUSH_SUBSCRIPTION_SECRET = 'test-sub-secret';

    db = openDb({ databaseUrl: process.env.DATABASE_URL });
    server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    delete process.env.PIH_PUSH_API_TOKEN;
    delete process.env.PIH_PUSH_SUBSCRIPTION_SECRET;
  });

  it('POST /api/push/subscribe without auth returns 401', async () => {
    const res = await requestJson<{ error?: string }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/subscribe',
      method: 'POST',
      body: { endpoint: 'https://example.com/e', keys: { p256dh: 'a', auth: 'b' } },
    });
    expect(res.status).toBe(401);
    expect(res.body?.error).toBe('unauthorized');
  });

  it('POST /api/push/subscribe with wrong Bearer token returns 401', async () => {
    const res = await requestJson({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/subscribe',
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
      body: { endpoint: 'https://example.com/e2', keys: { p256dh: 'a', auth: 'b' } },
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/push/subscribe with Authorization Bearer succeeds', async () => {
    const endpoint = 'https://example.com/ok';
    const res = await requestJson<{ success?: boolean }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/subscribe',
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { endpoint, keys: { p256dh: 'a', auth: 'b' } },
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const row = db
      .prepare('SELECT subscription_json FROM notification_subscriptions WHERE endpoint = ?')
      .get(endpoint) as { subscription_json: string } | undefined;
    expect(row).toBeTruthy();
    expect(row!.subscription_json.startsWith('enc:v1:')).toBe(true);
    expect(row!.subscription_json.includes(endpoint)).toBe(false);
  });

  it('POST /api/push/unsubscribe with X-PIH-Token succeeds', async () => {
    const res = await requestJson<{ success?: boolean }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/unsubscribe',
      method: 'POST',
      headers: { 'X-PIH-Token': token },
      body: { endpoint: 'https://example.com/ok' },
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('GET /api/push/consent returns shape without auth', async () => {
    const res = await requestJson<{
      success?: boolean;
      has_subscription?: boolean;
      push_permission_status?: string;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/consent',
      method: 'GET',
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(typeof res.body?.has_subscription).toBe('boolean');
    expect(typeof res.body?.push_permission_status).toBe('string');
  });
});
