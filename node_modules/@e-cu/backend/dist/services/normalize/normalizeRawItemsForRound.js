"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTRACTOR_VERSION = void 0;
exports.normalizeRawItemsForRound = normalizeRawItemsForRound;
const normalizeRawItem_1 = require("./normalizeRawItem");
const EXTRACTOR_VERSION = 'v1-rss-normalize-0';
exports.EXTRACTOR_VERSION = EXTRACTOR_VERSION;
async function normalizeRawItemsForRound(db, collection_round_id, createdAtUtcIso) {
    const rawItems = db
        .prepare(`
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
      `)
        .all(collection_round_id);
    const stmt = db.prepare(`
    INSERT OR REPLACE INTO normalized_items
      (collection_round_id, raw_item_id, extractor_version, source_type, source_id, external_id, title, published_at, url, author, language, timestamp_quality, content_text_or_excerpt, content_summary, created_at_utc)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const rawItem of rawItems) {
        const { content_summary, content_text_or_excerpt } = (0, normalizeRawItem_1.normalizeRawItem)(rawItem);
        stmt.run(collection_round_id, rawItem.id, EXTRACTOR_VERSION, rawItem.source_type, rawItem.source_id, rawItem.external_id, rawItem.title, rawItem.published_at ?? null, rawItem.url, rawItem.author ?? null, rawItem.language, rawItem.timestamp_quality, content_text_or_excerpt, content_summary, createdAtUtcIso);
    }
}
