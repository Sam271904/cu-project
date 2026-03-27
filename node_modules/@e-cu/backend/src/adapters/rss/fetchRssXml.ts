import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { throttleRssHost } from './rssHostThrottle';
import type { RssFetchConfig } from './rssFetchConfig';

export async function fetchRssXml(url: string, cfg?: RssFetchConfig): Promise<string> {
  const u = new URL(url);
  const client = u.protocol === 'https:' ? https : http;
  const maxAttempts = cfg?.maxAttempts ?? 3;
  const backoffBaseMs = cfg?.backoffBaseMs ?? 500;
  const backoffMaxMs = cfg?.backoffMaxMs ?? 8000;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1 && cfg?.rateLimitPerMinute) {
      await throttleRssHost(url, cfg.rateLimitPerMinute);
    }

    try {
      const body = await new Promise<string>((resolve, reject) => {
        const req = client.request(
          {
            method: 'GET',
            hostname: u.hostname,
            port: u.port,
            path: `${u.pathname}${u.search}`,
            headers: {
              'User-Agent': 'e-cu-rss-adapter',
              Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              const body = Buffer.concat(chunks).toString('utf-8');
              if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch RSS XML. status=${res.statusCode}`));
                return;
              }
              resolve(body);
            });
          }
        );
        req.on('error', reject);
        req.end();
      });
      return body;
    } catch (err) {
      lastError = err as Error;
      const isRetryable =
        lastError.message.includes('status=5') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('socket hang up');
      if (!isRetryable || attempt === maxAttempts) {
        throw lastError;
      }
      const backoffMs = Math.min(backoffMaxMs, backoffBaseMs * 2 ** (attempt - 2));
      await new Promise<void>((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastError ?? new Error('Unexpected retry loop exit');
}
