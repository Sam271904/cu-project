import { XMLParser } from 'fast-xml-parser';

import { RawItem } from './types';

function getText(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() ? v.trim() : undefined;
  if (!v || typeof v !== 'object') return undefined;

  const obj = v as Record<string, unknown>;
  const text = obj['#text'] ?? obj['__text'];
  if (typeof text === 'string') return text.trim() ? text.trim() : undefined;

  return undefined;
}

export function parseRssXml(opts: {
  xml: string;
  sourceId: string;
  sourceName?: string;
  nowUtcIso: string;
  language?: string;
}): RawItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    parseAttributeValue: true,
    textNodeName: '#text',
    // Ensure item is always treated as an array.
    isArray: (tagName) => tagName === 'item',
  });

  let doc: unknown;
  try {
    doc = parser.parse(opts.xml);
  } catch {
    // Let tests cover failure mode; preserve message for debugging.
    throw new Error('Failed to parse RSS XML');
  }

  const channel =
    (doc as any)?.rss?.channel ?? (doc as any)?.channel ?? (doc as any)?.['rss']?.['channel'];
  const rawItems = channel?.item ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const out: RawItem[] = [];
  const language = opts.language ?? 'en';

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const item = rawItem as Record<string, unknown>;

    const title = getText(item.title);
    if (!title) continue;

    const url = getText(item.link);
    if (!url) continue;

    const guid = getText(item.guid);
    const external_id = guid ?? url;

    const pubDateRaw = getText(item.pubDate);
    let published_at: string | undefined;
    let timestamp_quality: RawItem['timestamp_quality'] = 'missing';
    if (pubDateRaw) {
      const dt = new Date(pubDateRaw);
      if (!Number.isNaN(dt.getTime())) {
        published_at = dt.toISOString();
        timestamp_quality = 'pubDate';
      }
    }

    const description = getText(item.description);
    const summary = getText(item.summary);
    const excerpt_or_summary = description ?? summary;

    const author = getText(item.author);

    out.push({
      source_id: opts.sourceId,
      external_id,
      title,
      published_at,
      collected_at: opts.nowUtcIso,
      url,
      excerpt_or_summary,
      author,
      language,
      timestamp_quality,
    });
  }

  return out;
}

