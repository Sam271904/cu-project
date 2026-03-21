import { describe, expect, it } from 'vitest';
import {
  jaccardSimilarity,
  mergeUnionSets,
  minBipartitionJaccard,
  tokenizeContentSummary,
  type TokenizedItem,
} from '../src/services/cluster/mergeUtils';

describe('mergeUtils (Task 5.2 Jaccard)', () => {
  it('tokenizeContentSummary is deterministic and Unicode-safe', () => {
    const a = tokenizeContentSummary('Hello 世界 Pi3');
    const b = tokenizeContentSummary('hello 世界 pi3');
    expect([...a].sort()).toEqual([...b].sort());
    expect(a.has('hello')).toBe(true);
    expect(a.has('世界')).toBe(true);
    expect(a.has('pi3')).toBe(true);
  });

  it('jaccardSimilarity is 1 for identical sets', () => {
    const s = new Set(['a', 'b']);
    expect(jaccardSimilarity(s, s)).toBe(1);
  });

  it('jaccardSimilarity matches textbook example', () => {
    const a = new Set([1, 2, 3].map(String));
    const b = new Set([2, 3, 4].map(String));
    // intersection 2, union 4 => 0.5
    expect(jaccardSimilarity(a, b)).toBeCloseTo(0.5, 5);
  });

  it('mergeUnionSets mutates target', () => {
    const t = new Set(['x']);
    mergeUnionSets(t, new Set(['y', 'x']));
    expect([...t].sort()).toEqual(['x', 'y']);
  });

  it('minBipartitionJaccard: n<2 returns trivial', () => {
    const one: TokenizedItem[] = [{ id: 1, tokens: new Set(['a']) }];
    expect(minBipartitionJaccard(one)).toEqual({ minJ: 1, bestK: 0 });
  });

  it('minBipartitionJaccard: two disjoint items => Jaccard 0, bestK=1', () => {
    const items: TokenizedItem[] = [
      { id: 1, tokens: tokenizeContentSummary('alpha beta gamma') },
      { id: 2, tokens: tokenizeContentSummary('zzz www yyy') },
    ];
    expect(minBipartitionJaccard(items)).toEqual({ minJ: 0, bestK: 1 });
  });

  it('minBipartitionJaccard: tie picks smaller k', () => {
    const items: TokenizedItem[] = [
      { id: 1, tokens: new Set(['a']) },
      { id: 2, tokens: new Set(['b']) },
      { id: 3, tokens: new Set(['c']) },
    ];
    const { bestK } = minBipartitionJaccard(items);
    expect(bestK).toBe(1);
  });
});
