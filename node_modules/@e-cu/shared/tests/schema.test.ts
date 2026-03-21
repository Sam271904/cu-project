import { describe, expect, it } from 'vitest';
import {
  EvidenceSnippetSchema,
  EvidenceRefSchema,
  clusterId,
  evidenceRefId,
} from '../src/index';

describe('shared schemas v1', () => {
  it('rejects EvidenceSnippet.snippet_text longer than 600 chars', () => {
    const tooLong = 'a'.repeat(601);
    expect(() =>
      EvidenceSnippetSchema.parse({
        snippet_text: tooLong,
        snippet_language: 'en',
        extractor_version: 'x.y.z',
      }),
    ).toThrow();
  });

  it('rejects EvidenceRef missing extractor_version', () => {
    expect(() =>
      EvidenceRefSchema.parse({
        normalized_item_id: 'n-1',
        url: 'https://example.com/a',
        published_at: '2026-03-20T00:00:00.000Z',
        confidence: 0.5,
        extracted_spans: [
          { start_char: 0, end_char: 1, span_type: 'context', confidence: 0.9 },
        ],
      }),
    ).toThrow();
  });

  it('rejects extracted_spans that include any text fields', () => {
    expect(() =>
      EvidenceRefSchema.parse({
        normalized_item_id: 'n-1',
        url: 'https://example.com/a',
        published_at: '2026-03-20T00:00:00.000Z',
        extractor_version: 'x.y.z',
        confidence: 0.5,
        extracted_spans: [
          {
            start_char: 0,
            end_char: 1,
            span_type: 'context',
            confidence: 0.9,
            // should be rejected by strict span schema
            span_text: 'not-allowed',
          },
        ],
      }),
    ).toThrow();
  });

  it('validates extracted_spans field types and ranges', () => {
    // start_char must be int >= 0
    expect(() =>
      EvidenceRefSchema.parse({
        normalized_item_id: 'n-1',
        url: 'https://example.com/a',
        published_at: '2026-03-20T00:00:00.000Z',
        extractor_version: 'x.y.z',
        confidence: 0.5,
        extracted_spans: [
          { start_char: -1, end_char: 2, span_type: 'context', confidence: 0.9 },
        ],
      }),
    ).toThrow();

    // end_char must be int >=0 and > start_char
    expect(() =>
      EvidenceRefSchema.parse({
        normalized_item_id: 'n-1',
        url: 'https://example.com/a',
        published_at: '2026-03-20T00:00:00.000Z',
        extractor_version: 'x.y.z',
        confidence: 0.5,
        extracted_spans: [
          { start_char: 2, end_char: 2, span_type: 'context', confidence: 0.9 },
        ],
      }),
    ).toThrow();

    // confidence must be within [0, 1]
    expect(() =>
      EvidenceRefSchema.parse({
        normalized_item_id: 'n-1',
        url: 'https://example.com/a',
        published_at: '2026-03-20T00:00:00.000Z',
        extractor_version: 'x.y.z',
        confidence: 0.5,
        extracted_spans: [
          { start_char: 0, end_char: 2, span_type: 'context', confidence: 1.1 },
        ],
      }),
    ).toThrow();
  });

  it('is deterministic for clusterId/evidenceRefId', () => {
    const c1 = clusterId('sig-abc', 'm-v1');
    const c2 = clusterId('sig-abc', 'm-v1');
    expect(c1).toBe(c2);

    const e1 = evidenceRefId('normalized-1', 'extractor-v1');
    const e2 = evidenceRefId('normalized-1', 'extractor-v1');
    expect(e1).toBe(e2);
  });
});

