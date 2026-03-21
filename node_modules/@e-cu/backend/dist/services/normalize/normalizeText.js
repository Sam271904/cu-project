"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
exports.truncateWithEllipsis = truncateWithEllipsis;
exports.firstSentence = firstSentence;
function stripHtmlTags(input) {
    // Minimal HTML stripping for RSS descriptions/encoded fields.
    // This is deterministic and avoids introducing extra parsing dependencies.
    return input.replace(/<[^>]*>/g, ' ');
}
function collapseWhitespace(input) {
    return input.replace(/\s+/g, ' ').trim();
}
function decodeBasicEntities(input) {
    // Minimal entity decoding (extend only if you have fixtures that require it).
    return input
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
function removeTemplateTail(input) {
    // Remove common "read more" / "view original" template tails that appear at the end of feeds.
    // Keep this conservative: only strip when the marker is near the end and becomes the tail section.
    const withoutEntities = input.trim();
    // Typical English markers
    let t = withoutEntities.replace(/\s*(?:\bread more\b|\bview original\b|\bcontinue reading\b|\bshow more\b)\s*$/i, '');
    // Typical Chinese markers
    t = t.replace(/\s*(?:查看更多|阅读全文|点此查看|查看全文)\s*$/i, '');
    // Bracketed forms: "[Read more]" / "(查看更多)" etc.
    t = t.replace(/\s*[\[(（【{]?\s*(?:read more|view original|continue reading|show more)\s*[\])）】}]?\s*$/i, '');
    return t.trim();
}
function normalizeText(input) {
    const decoded = decodeBasicEntities(input);
    const stripped = stripHtmlTags(decoded);
    const collapsed = collapseWhitespace(stripped);
    return removeTemplateTail(collapsed);
}
function truncateWithEllipsis(input, maxChars) {
    if (input.length <= maxChars)
        return input;
    if (maxChars <= 3)
        return input.slice(0, maxChars);
    return input.slice(0, maxChars - 3) + '...';
}
function firstSentence(input) {
    // Deterministic sentence heuristic for content_summary.
    const m = input.match(/(.+?[.!?])(\s|$)/);
    return (m?.[1] ?? input).trim();
}
