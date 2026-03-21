import { describe, expect, it } from 'vitest';

import {
  bookmarkExternalIdFromUrl,
  bookmarkFolderSourceId,
  normalizeBookmarkUrlForId,
} from '../src/services/bookmarks/bookmarkIds';

describe('bookmarkIds', () => {
  it('normalizeBookmarkUrlForId strips hash and requires http(s)', () => {
    expect(normalizeBookmarkUrlForId('https://ExAmple.com/path?q=1#frag')).toBe('https://example.com/path?q=1');
    expect(normalizeBookmarkUrlForId('  https://a.com/  ')).toBe('https://a.com/');
    expect(normalizeBookmarkUrlForId('ftp://a.com')).toBe('');
    expect(normalizeBookmarkUrlForId('not-a-url')).toBe('');
  });

  it('bookmarkExternalIdFromUrl is stable for normalized URL', () => {
    const a = bookmarkExternalIdFromUrl('https://example.com/a#x');
    const b = bookmarkExternalIdFromUrl('https://example.com/a#y');
    expect(a).toBe(b);
    expect(a.length).toBe(64);
  });

  it('bookmarkFolderSourceId is stable per folder', () => {
    expect(bookmarkFolderSourceId('')).toBe('bookmarks');
    expect(bookmarkFolderSourceId('Read later')).toBe(bookmarkFolderSourceId('Read later'));
    expect(bookmarkFolderSourceId('A')).not.toBe(bookmarkFolderSourceId('B'));
  });
});
