import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export async function fetchRssXml(url: string): Promise<string> {
  const u = new URL(url);
  const client = u.protocol === 'https:' ? https : http;

  return await new Promise<string>((resolve, reject) => {
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
}

