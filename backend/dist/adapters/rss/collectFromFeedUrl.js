"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectRssFromUrl = collectRssFromUrl;
const parser_1 = require("./parser");
const fetchRssXml_1 = require("./fetchRssXml");
async function collectRssFromUrl(opts) {
    const xml = await (0, fetchRssXml_1.fetchRssXml)(opts.feedUrl);
    const parsedItems = (0, parser_1.parseRssXml)({
        xml,
        sourceId: opts.sourceId,
        sourceName: opts.sourceName,
        nowUtcIso: opts.nowUtcIso,
        language: opts.language,
    });
    // first wins: preserve the first item for each external_id within this collection run.
    const byExternalId = new Map();
    for (const item of parsedItems) {
        if (!byExternalId.has(item.external_id)) {
            byExternalId.set(item.external_id, item);
        }
    }
    return Array.from(byExternalId.values());
}
