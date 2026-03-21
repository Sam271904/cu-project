import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectRssFromUrl } from '../src/adapters/rss/collectFromFeedUrl';

describe('rss collect', () => {
  let server: ReturnType<typeof http.createServer>;
  let port = 0;

  beforeAll(async () => {
    const rssXml = `
<rss version="2.0">
  <channel>
    <title>Example RSS</title>
    <item>
      <title>Item One</title>
      <link>https://example.com/item-1</link>
      <guid>dup-guid</guid>
      <description>First description</description>
      <author>First author</author>
    </item>
    <item>
      <title>Item Two</title>
      <link>https://example.com/item-2</link>
      <guid>dup-guid</guid>
      <description>Second description</description>
      <author>Second author</author>
    </item>
  </channel>
</rss>
`.trim();

    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(rssXml);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port as number;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('collects and dedupes by external_id (first wins)', async () => {
    const nowUtcIso = '2026-03-20T12:34:56.000Z';

    const items = await collectRssFromUrl({
      feedUrl: `http://127.0.0.1:${port}/feed`,
      sourceId: 'source-1',
      sourceName: 'Source One',
      nowUtcIso,
      language: 'en',
    });

    expect(items).toHaveLength(1);
    for (const item of items) {
      expect(item.collected_at).toBe(nowUtcIso);
    }

    expect(items[0]?.external_id).toBe('dup-guid');
    expect(items[0]?.excerpt_or_summary).toBe('First description');
  });
});

