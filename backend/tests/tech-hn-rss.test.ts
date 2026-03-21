import { describe, expect, it } from 'vitest';
import { HACKER_NEWS_FRONT_PAGE_RSS } from '../src/adapters/tech/knownFeeds';
import { parseRssXml } from '../src/adapters/rss/parser';

/**
 * Task 3.3 — tech community RSS shape (Hacker News–style item fields).
 * Network-free: fixture only; preset URL is documented for real collect.
 */
describe('tech RSS preset (HN-shaped fixture)', () => {
  it('exports stable HN front-page RSS URL', () => {
    expect(HACKER_NEWS_FRONT_PAGE_RSS).toBe('https://news.ycombinator.com/rss');
  });

  it('parses HN-like items into raw-shaped fields', () => {
    const xml = `
<rss version="2.0">
  <channel>
    <title>Hacker News</title>
    <item>
      <title>Show HN: Example</title>
      <link>https://example.com/story</link>
      <comments>https://news.ycombinator.com/item?id=1</comments>
      <guid>https://news.ycombinator.com/item?id=1</guid>
      <pubDate>Mon, 20 Mar 2026 12:00:00 GMT</pubDate>
      <description>Discussion thread summary line.</description>
    </item>
  </channel>
</rss>`.trim();

    const items = parseRssXml({
      xml,
      sourceId: 'hn-tech',
      nowUtcIso: '2026-03-20T12:00:00.000Z',
      language: 'en',
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Show HN: Example');
    expect(items[0]?.url).toBe('https://example.com/story');
    expect(items[0]?.external_id).toContain('ycombinator.com');
    expect(items[0]?.excerpt_or_summary).toBe('Discussion thread summary line.');
  });
});
