import { RawItem } from './types';
import { parseRssXml } from './parser';
import { fetchRssXml } from './fetchRssXml';

export async function collectRssFromUrl(opts: {
  feedUrl: string;
  sourceId: string;
  sourceName?: string;
  nowUtcIso: string;
  language?: string;
}): Promise<RawItem[]> {
  const xml = await fetchRssXml(opts.feedUrl);

  const parsedItems = parseRssXml({
    xml,
    sourceId: opts.sourceId,
    sourceName: opts.sourceName,
    nowUtcIso: opts.nowUtcIso,
    language: opts.language,
  });

  // first wins: preserve the first item for each external_id within this collection run.
  const byExternalId = new Map<string, RawItem>();
  for (const item of parsedItems) {
    if (!byExternalId.has(item.external_id)) {
      byExternalId.set(item.external_id, item);
    }
  }

  return Array.from(byExternalId.values());
}

