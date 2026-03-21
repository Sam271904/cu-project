import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  clusterId,
  disagreementStructHash,
  eventKey,
  evidenceRefId,
  signalFingerprint,
} from '../src/index';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

describe('deterministic ids (Task 1.2)', () => {
  it('clusterId matches SHA-256_hex(canonical_signature|clustering_model_version)', () => {
    const sig = 'domain:example.com|week:2026-W12|entity:Alpha';
    const ver = 'cluster-v1';
    expect(clusterId(sig, ver)).toBe(sha256Hex(`${sig}|${ver}`));
  });

  it('evidenceRefId is normalized_item_id|extractor_version', () => {
    expect(evidenceRefId('42', 'ext-v0')).toBe('42|ext-v0');
  });

  it('disagreementStructHash matches concatenation contract', () => {
    const h = disagreementStructHash('r', 'o', 'd', ['s1', 's2'], ['g1']);
    expect(h).toBe(sha256Hex('r|o|d|s1,s2|g1'));
  });

  it('signalFingerprint sorts evidence ref ids and hashes 5 pipe-separated parts', () => {
    const fp = signalFingerprint('sch-v1', 'added', ['b|v', 'a|v'], 'LATEST_WINS', 'structhash');
    expect(fp).toBe(sha256Hex(['sch-v1', 'added', 'a|v,b|v', 'LATEST_WINS', 'structhash'].join('|')));
  });

  it('eventKey is representative cluster id string', () => {
    expect(eventKey('cluster-abc')).toBe('cluster-abc');
  });
});
