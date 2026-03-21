import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../src/server';

describe('backend health endpoint', () => {
  let server: ReturnType<typeof createServer>;
  let port = 0;

  beforeAll(async () => {
    server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port as number;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET /health returns 200 and {status:"ok"}', async () => {
    const { status, body } = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/health',
            method: 'GET',
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              resolve({
                status: res.statusCode ?? 0,
                body: Buffer.concat(chunks).toString('utf-8'),
              });
            });
          }
        );

        req.on('error', reject);
        req.end();
      }
    );

    expect(status).toBe(200);
    expect(body).toContain('"status":"ok"');
  });
});

