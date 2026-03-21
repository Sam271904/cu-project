import crypto from 'node:crypto';

/**
 * Normalize URL for stable bookmark identity (strip hash, trim).
 */
export function normalizeBookmarkUrlForId(url: string): string {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    u.hash = '';
    return u.href;
  } catch {
    return '';
  }
}

export function bookmarkExternalIdFromUrl(url: string): string {
  const n = normalizeBookmarkUrlForId(url);
  if (!n) return '';
  return crypto.createHash('sha256').update(n).digest('hex');
}

export function bookmarkFolderSourceId(folder: string): string {
  const f = folder.trim();
  if (!f) return 'bookmarks';
  return `bm_${crypto.createHash('sha256').update(f).digest('hex').slice(0, 24)}`;
}
