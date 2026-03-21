/**
 * Task 5.2 merge heuristic (v1): Jaccard similarity on word tokens from content_summary.
 * Threshold: overlap > 0.7 => attach evidence to existing representative cluster (alias row for canonical id).
 */
export const MERGE_JACCARD_THRESHOLD = 0.7;

/** Task 5.2 Split: if best bipartition of evidence (by id order) has Jaccard < 0.4 for N=2 consecutive checks, split. */
export const SPLIT_JACCARD_THRESHOLD = 0.4;

/** Lowercase tokens (letters + numbers, Unicode) from summary — deterministic after NFKC. */
export function tokenizeContentSummary(summary: string): Set<string> {
  const s = String(summary).toLowerCase().normalize('NFKC');
  const words = s.match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const u = a.size + b.size - inter;
  return u === 0 ? 0 : inter / u;
}

export function mergeUnionSets(into: Set<string>, from: Set<string>): void {
  for (const x of from) into.add(x);
}

export type TokenizedItem = { id: number; tokens: Set<string> };

/**
 * Items must be sorted by id ascending. Tries every cut k in [1, n-1]:
 * left = [0..k-1], right = [k..n-1]. Returns minimum Jaccard(union left, union right) and the cut index k that achieves it (smallest k on tie).
 */
export function minBipartitionJaccard(sortedItems: TokenizedItem[]): { minJ: number; bestK: number } {
  const n = sortedItems.length;
  if (n < 2) return { minJ: 1, bestK: 0 };

  let bestJ = Number.POSITIVE_INFINITY;
  let bestK = 1;

  for (let k = 1; k <= n - 1; k += 1) {
    const leftU = new Set<string>();
    const rightU = new Set<string>();
    for (let i = 0; i < k; i += 1) mergeUnionSets(leftU, sortedItems[i]!.tokens);
    for (let i = k; i < n; i += 1) mergeUnionSets(rightU, sortedItems[i]!.tokens);
    const j = jaccardSimilarity(leftU, rightU);
    if (j < bestJ - 1e-15 || (Math.abs(j - bestJ) < 1e-15 && k < bestK)) {
      bestJ = j;
      bestK = k;
    }
  }

  return { minJ: bestJ, bestK };
}
