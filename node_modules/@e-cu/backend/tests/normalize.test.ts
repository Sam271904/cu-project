import { describe, expect, it } from 'vitest';

import { normalizeText, truncateWithEllipsis } from '../src/services/normalize/normalizeText';
import { normalizeRawItem } from '../src/services/normalize/normalizeRawItem';

describe('normalize', () => {
  it('strip html tags and collapse whitespace deterministically', () => {
    const input = ' <p>Social <b>hello</b></p>   world \n';
    const out = normalizeText(input);
    expect(out).toBe('Social hello world');
  });

  it('truncateWithEllipsis uses ... deterministically', () => {
    const input = 'abcdefghij';
    expect(truncateWithEllipsis(input, 10)).toBe('abcdefghij');
    expect(truncateWithEllipsis(input, 7)).toBe('abcd...');
  });

  it('normalizeRawItem uses social vs tech excerpt limits', () => {
    const longText = 'x'.repeat(900);
    const social = normalizeRawItem({
      source_id: 's1',
      source_name: 'Social',
      external_id: 'e1',
      title: 'T',
      published_at: undefined,
      collected_at: '2026-03-20T12:34:56.000Z',
      url: 'https://example.com',
      excerpt_or_summary: longText,
      author: undefined,
      language: 'en',
      timestamp_quality: 'missing',
      source_type: 'social',
      id: 1,
      // extra fields ignored by runtime
    } as any);

    const tech = normalizeRawItem({
      source_id: 't1',
      source_name: 'Tech',
      external_id: 'e2',
      title: 'T',
      published_at: undefined,
      collected_at: '2026-03-20T12:34:56.000Z',
      url: 'https://example.com',
      excerpt_or_summary: longText,
      author: undefined,
      language: 'en',
      timestamp_quality: 'missing',
      source_type: 'tech',
      id: 2,
    } as any);

    expect(social.content_text_or_excerpt.length).toBeLessThanOrEqual(503); // 500 + '...'
    expect(tech.content_text_or_excerpt.length).toBeLessThanOrEqual(1003); // 1000 + '...'
  });

  it('normalizeRawItem applies source_type prefix cleanup', () => {
    const social = normalizeRawItem({
      source_id: 's1',
      source_name: 'Social',
      external_id: 'e1',
      title: 'T',
      published_at: undefined,
      collected_at: '2026-03-20T12:34:56.000Z',
      url: 'https://example.com',
      excerpt_or_summary: 'RT hello from repost',
      author: undefined,
      language: 'en',
      timestamp_quality: 'missing',
      source_type: 'social',
      id: 1,
    } as any);

    expect(social.content_text_or_excerpt).toBe('hello from repost');
    expect(social.content_summary).toBe('hello from repost');

    const tech = normalizeRawItem({
      source_id: 't1',
      source_name: 'Tech',
      external_id: 'e2',
      title: 'T',
      published_at: undefined,
      collected_at: '2026-03-20T12:34:56.000Z',
      url: 'https://example.com',
      excerpt_or_summary: 'Updated: 2026-01-01 hello from update',
      author: undefined,
      language: 'en',
      timestamp_quality: 'missing',
      source_type: 'tech',
      id: 2,
    } as any);

    expect(tech.content_text_or_excerpt).toBe('hello from update');
    expect(tech.content_summary).toBe('hello from update');

    const bookmark = normalizeRawItem({
      source_id: 'b1',
      source_name: 'Bookmarks',
      external_id: 'e3',
      title: 'T',
      published_at: undefined,
      collected_at: '2026-03-20T12:34:56.000Z',
      url: 'https://example.com/x',
      excerpt_or_summary: 'Updated: 2026-01-01 user note kept',
      author: undefined,
      language: 'en',
      timestamp_quality: 'missing',
      source_type: 'bookmark',
      id: 3,
    } as any);

    expect(bookmark.content_text_or_excerpt).toContain('Updated:');
    expect(bookmark.content_summary).toContain('Updated:');
  });

  it('removeTemplateTail strips read-more markers only at the end', () => {
    const input = 'Hello World   Read more';
    expect(normalizeText(input)).toBe('Hello World');

    const input2 = 'Hello World 查看更多';
    expect(normalizeText(input2)).toBe('Hello World');

    // Mid-sentence "read more" should not be stripped because it's not a tail.
    const mid = 'Hello Read more world';
    expect(normalizeText(mid)).toBe('Hello Read more world');
  });
});
