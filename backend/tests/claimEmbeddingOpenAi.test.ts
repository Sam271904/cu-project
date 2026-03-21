import { describe, expect, it } from 'vitest';

import { parseEmbeddingJson } from '../src/services/signal_extraction/claimEmbeddingOpenAi';

describe('claimEmbeddingOpenAi', () => {
  it('parseEmbeddingJson accepts number arrays', () => {
    expect(parseEmbeddingJson(JSON.stringify([0.1, 0.2]))).toEqual([0.1, 0.2]);
    expect(parseEmbeddingJson('')).toBeNull();
    expect(parseEmbeddingJson('[1,"x"]')).toBeNull();
  });
});
