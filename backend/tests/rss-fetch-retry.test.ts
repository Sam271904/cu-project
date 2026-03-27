import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { fetchRssXml } from '../src/adapters/rss/fetchRssXml';
import type { RssFetchConfig } from '../src/adapters/rss/rssFetchConfig';
import { resetRssHostThrottleForTests } from '../src/adapters/rss/rssHostThrottle';

describe('fetchRssXml retry + throttle', () => {
  afterEach(() => {
    resetRssHostThrottleForTests();
  });

  it('retries on 503 then returns 200 body', async () => {
    let hits = 0;
    const rssXml = `<rss version="2.0"><channel><title>T</title></channel></rss>`;
    const server = http.createServer((_req, res) => {
      hits += 1;
      if (hits === 1) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('unavailable');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(rssXml);
    });

    const port: number = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve((server.address() as { port: number }).port);
      });
    });

    const cfg: RssFetchConfig = {
      maxAttempts: 3,
      backoffBaseMs: 10,
      backoffMaxMs: 50,
      rateLimitPerMinute: 0,
    };

    try {
      const xml = await fetchRssXml(`http://127.0.0.1:${port}/feed`, cfg);
      expect(hits).toBe(2);
      expect(xml).toContain('<rss');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
