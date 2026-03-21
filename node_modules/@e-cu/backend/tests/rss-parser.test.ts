import { describe, expect, it } from 'vitest';
import { parseRssXml } from '../src/adapters/rss/parser';

describe('rss parser', () => {
  it('parses pubDate and maps description to excerpt_or_summary', () => {
    const nowUtcIso = '2026-03-20T12:34:56.000Z';

    const rssXml = `
<rss version="2.0">
  <channel>
    <title>Example RSS</title>
    <item>
      <title>Item One</title>
      <link>https://example.com/item-1</link>
      <guid>guid-1</guid>
      <pubDate>Mon, 15 Mar 2021 10:00:00 GMT</pubDate>
      <description>Desc one</description>
      <author>Author One</author>
    </item>
    <item>
      <title>Item Two</title>
      <link>https://example.com/item-2</link>
      <guid>guid-2</guid>
      <description>Desc two</description>
      <summary>Summary two</summary>
    </item>
  </channel>
</rss>
`.trim();

    const items = parseRssXml({
      xml: rssXml,
      sourceId: 'source-1',
      nowUtcIso,
    });

    expect(items).toHaveLength(2);

    for (const item of items) {
      expect(item.external_id).toBeTruthy();
      expect(item.url).toBeTruthy();
      expect(item.collected_at).toBe(nowUtcIso);
      expect(item.language).toBe('en');
    }

    expect(items[0]?.external_id).toBe('guid-1');
    expect(items[0]?.url).toBe('https://example.com/item-1');
    expect(items[0]?.excerpt_or_summary).toBe('Desc one');
    expect(items[0]?.published_at).toBe('2021-03-15T10:00:00.000Z');
    expect(items[0]?.timestamp_quality).toBe('pubDate');

    expect(items[1]?.external_id).toBe('guid-2');
    expect(items[1]?.url).toBe('https://example.com/item-2');
    expect(items[1]?.excerpt_or_summary).toBe('Desc two');
    expect(items[1]?.published_at).toBeUndefined();
    expect(items[1]?.timestamp_quality).toBe('missing');
  });
});

