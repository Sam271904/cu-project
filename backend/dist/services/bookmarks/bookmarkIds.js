"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBookmarkUrlForId = normalizeBookmarkUrlForId;
exports.bookmarkExternalIdFromUrl = bookmarkExternalIdFromUrl;
exports.bookmarkFolderSourceId = bookmarkFolderSourceId;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * Normalize URL for stable bookmark identity (strip hash, trim).
 */
function normalizeBookmarkUrlForId(url) {
    try {
        const u = new URL(url.trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:')
            return '';
        u.hash = '';
        return u.href;
    }
    catch {
        return '';
    }
}
function bookmarkExternalIdFromUrl(url) {
    const n = normalizeBookmarkUrlForId(url);
    if (!n)
        return '';
    return node_crypto_1.default.createHash('sha256').update(n).digest('hex');
}
function bookmarkFolderSourceId(folder) {
    const f = folder.trim();
    if (!f)
        return 'bookmarks';
    return `bm_${node_crypto_1.default.createHash('sha256').update(f).digest('hex').slice(0, 24)}`;
}
