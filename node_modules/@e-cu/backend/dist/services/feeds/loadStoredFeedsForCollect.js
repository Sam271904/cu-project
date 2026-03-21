"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadStoredFeedsForCollect = loadStoredFeedsForCollect;
/**
 * Maps enabled RSS rows into the shape expected by `/api/collect` ingestion.
 */
function loadStoredFeedsForCollect(db) {
    const rows = db
        .prepare(`
      SELECT source_type, feed_url, source_id, source_name
      FROM rss_feed_configs
      WHERE enabled = 1
      ORDER BY sort_order ASC, id ASC
      `)
        .all();
    const socialRssFeeds = [];
    const techRssFeeds = [];
    for (const r of rows) {
        const item = { feedUrl: r.feed_url };
        if (r.source_id)
            item.sourceId = r.source_id;
        if (r.source_name)
            item.sourceName = r.source_name;
        if (r.source_type === 'social')
            socialRssFeeds.push(item);
        else
            techRssFeeds.push(item);
    }
    return { socialRssFeeds, techRssFeeds };
}
