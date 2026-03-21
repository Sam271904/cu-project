import type { RawItem } from '../../adapters/rss/types';
import { firstSentence, normalizeText, truncateWithEllipsis } from './normalizeText';

export function normalizeRawItem(rawItem: RawItem & { source_type: 'social' | 'tech' | 'bookmark' }): {
  content_text_or_excerpt: string;
  content_summary: string;
} {
  const source_type = rawItem.source_type;
  const base = rawItem.excerpt_or_summary ?? rawItem.title;
  let cleaned = normalizeText(base);

  // Source-type specific cleanup rules (v1):
  // - social: strip repost prefixes
  // - tech: strip leading "Updated:"-like metadata
  // - bookmark: user-curated text; no aggressive boilerplate stripping
  if (source_type === 'social') {
    cleaned = cleaned.replace(/^(?:RT)\s+/i, '');
    cleaned = cleaned.replace(/^转发\s+/i, '');
  } else if (source_type === 'tech') {
    cleaned = cleaned.replace(
      /^(?:Updated|Update|Published|Last updated)\s*:\s*[^ ]+\s+/i,
      ''
    );
  }

  const maxExcerpt = source_type === 'social' ? 500 : 1000;
  const content_text_or_excerpt = truncateWithEllipsis(cleaned, maxExcerpt);

  const summaryBase = firstSentence(cleaned);
  const content_summary = truncateWithEllipsis(summaryBase, 200);

  return { content_text_or_excerpt, content_summary };
}

