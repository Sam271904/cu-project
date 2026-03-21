import type Database from 'better-sqlite3';

import type { RawItem } from '../../adapters/rss/types';
import { normalizeRawItem } from './normalizeRawItem';

const EXTRACTOR_VERSION = 'v1-rss-normalize-0';

export async function normalizeRawItemsForRound(
  db: Database.Database,
  collection_round_id: number,
  createdAtUtcIso: string,
): Promise<void> {
  const rawItems: Array<RawItem & { id: number; source_type: 'social' | 'tech' | 'bookmark' }> = db
    .prepare(
      `
      SELECT
        id,
        collection_round_id,
        source_type,
        source_id,
        source_name,
        external_id,
        title,
        published_at,
        collected_at,
        url,
        excerpt_or_summary,
        author,
        language,
        timestamp_quality
      FROM raw_items
      WHERE collection_round_id = ?
      ORDER BY id ASC
      `
    )
    .all(collection_round_id) as any;

  const stmt = db.prepare(
    `
    INSERT OR REPLACE INTO normalized_items
      (collection_round_id, raw_item_id, extractor_version, source_type, source_id, external_id, title, published_at, url, author, language, timestamp_quality, content_text_or_excerpt, content_summary, created_at_utc)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const rawItem of rawItems) {
    const { content_summary, content_text_or_excerpt } = normalizeRawItem(rawItem);
    stmt.run(
      collection_round_id,
      rawItem.id,
      EXTRACTOR_VERSION,
      rawItem.source_type,
      rawItem.source_id,
      rawItem.external_id,
      rawItem.title,
      rawItem.published_at ?? null,
      rawItem.url,
      rawItem.author ?? null,
      rawItem.language,
      rawItem.timestamp_quality,
      content_text_or_excerpt,
      content_summary
      ,
      createdAtUtcIso
    );
  }
}

export { EXTRACTOR_VERSION };

