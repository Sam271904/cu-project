import type Database from 'better-sqlite3';

export type CollectFeedInput = {
  feedUrl: string;
  sourceId?: string;
  sourceName?: string;
};

/**
 * Maps enabled RSS rows into the shape expected by `/api/collect` ingestion.
 */
export function loadStoredFeedsForCollect(db: Database.Database): {
  socialRssFeeds: CollectFeedInput[];
  techRssFeeds: CollectFeedInput[];
} {
  const rows = db
    .prepare(
      `
      SELECT source_type, feed_url, source_id, source_name
      FROM rss_feed_configs
      WHERE enabled = 1
      ORDER BY sort_order ASC, id ASC
      `,
    )
    .all() as Array<{
    source_type: string;
    feed_url: string;
    source_id: string | null;
    source_name: string | null;
  }>;

  const socialRssFeeds: CollectFeedInput[] = [];
  const techRssFeeds: CollectFeedInput[] = [];

  for (const r of rows) {
    const item: CollectFeedInput = { feedUrl: r.feed_url };
    if (r.source_id) item.sourceId = r.source_id;
    if (r.source_name) item.sourceName = r.source_name;
    if (r.source_type === 'social') socialRssFeeds.push(item);
    else techRssFeeds.push(item);
  }

  return { socialRssFeeds, techRssFeeds };
}
