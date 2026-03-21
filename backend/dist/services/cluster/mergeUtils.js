"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPLIT_JACCARD_THRESHOLD = exports.MERGE_JACCARD_THRESHOLD = void 0;
exports.tokenizeContentSummary = tokenizeContentSummary;
exports.jaccardSimilarity = jaccardSimilarity;
exports.mergeUnionSets = mergeUnionSets;
exports.minBipartitionJaccard = minBipartitionJaccard;
/**
 * Task 5.2 merge heuristic (v1): Jaccard similarity on word tokens from content_summary.
 * Threshold: overlap > 0.7 => attach evidence to existing representative cluster (alias row for canonical id).
 */
exports.MERGE_JACCARD_THRESHOLD = 0.7;
/** Task 5.2 Split: if best bipartition of evidence (by id order) has Jaccard < 0.4 for N=2 consecutive checks, split. */
exports.SPLIT_JACCARD_THRESHOLD = 0.4;
/** Lowercase tokens (letters + numbers, Unicode) from summary — deterministic after NFKC. */
function tokenizeContentSummary(summary) {
    const s = String(summary).toLowerCase().normalize('NFKC');
    const words = s.match(/[\p{L}\p{N}]+/gu) ?? [];
    return new Set(words);
}
function jaccardSimilarity(a, b) {
    if (a.size === 0 && b.size === 0)
        return 1;
    if (a.size === 0 || b.size === 0)
        return 0;
    let inter = 0;
    for (const x of a) {
        if (b.has(x))
            inter += 1;
    }
    const u = a.size + b.size - inter;
    return u === 0 ? 0 : inter / u;
}
function mergeUnionSets(into, from) {
    for (const x of from)
        into.add(x);
}
/**
 * Items must be sorted by id ascending. Tries every cut k in [1, n-1]:
 * left = [0..k-1], right = [k..n-1]. Returns minimum Jaccard(union left, union right) and the cut index k that achieves it (smallest k on tie).
 */
function minBipartitionJaccard(sortedItems) {
    const n = sortedItems.length;
    if (n < 2)
        return { minJ: 1, bestK: 0 };
    let bestJ = Number.POSITIVE_INFINITY;
    let bestK = 1;
    for (let k = 1; k <= n - 1; k += 1) {
        const leftU = new Set();
        const rightU = new Set();
        for (let i = 0; i < k; i += 1)
            mergeUnionSets(leftU, sortedItems[i].tokens);
        for (let i = k; i < n; i += 1)
            mergeUnionSets(rightU, sortedItems[i].tokens);
        const j = jaccardSimilarity(leftU, rightU);
        if (j < bestJ - 1e-15 || (Math.abs(j - bestJ) < 1e-15 && k < bestK)) {
            bestJ = j;
            bestK = k;
        }
    }
    return { minJ: bestJ, bestK };
}
