"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRawItem = normalizeRawItem;
const normalizeText_1 = require("./normalizeText");
function normalizeRawItem(rawItem) {
    const source_type = rawItem.source_type;
    const base = rawItem.excerpt_or_summary ?? rawItem.title;
    let cleaned = (0, normalizeText_1.normalizeText)(base);
    // Source-type specific cleanup rules (v1):
    // - social: strip repost prefixes
    // - tech: strip leading "Updated:"-like metadata
    // - bookmark: user-curated text; no aggressive boilerplate stripping
    if (source_type === 'social') {
        cleaned = cleaned.replace(/^(?:RT)\s+/i, '');
        cleaned = cleaned.replace(/^转发\s+/i, '');
    }
    else if (source_type === 'tech') {
        cleaned = cleaned.replace(/^(?:Updated|Update|Published|Last updated)\s*:\s*[^ ]+\s+/i, '');
    }
    const maxExcerpt = source_type === 'social' ? 500 : 1000;
    const content_text_or_excerpt = (0, normalizeText_1.truncateWithEllipsis)(cleaned, maxExcerpt);
    const summaryBase = (0, normalizeText_1.firstSentence)(cleaned);
    const content_summary = (0, normalizeText_1.truncateWithEllipsis)(summaryBase, 200);
    return { content_text_or_excerpt, content_summary };
}
