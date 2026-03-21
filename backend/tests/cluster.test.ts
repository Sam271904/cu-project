import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDb } from '../src/db/db';
import type Database from 'better-sqlite3';
import {
  canonicalSignatureForItem,
  clusterId,
  clusterKindFromDeltas,
  clusterNormalizedItemsForRound,
  isoWeekBucket,
} from '../src/services/cluster/clusterNormalizedItemsForRound';

describe('cluster service (deterministic)', () => {
  let db: Database.Database;
  let dbPath = '';
  let roundId = 0;

  const nowUtcIso = '2026-03-20T12:34:56.000Z';
  const createdAtUtcIso = '2026-03-20T12:34:56.000Z';

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `e-cu-cluster-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env.DATABASE_URL = `sqlite:${dbPath}`;
    db = openDb({ databaseUrl: process.env.DATABASE_URL });

    const round = db
      .prepare('INSERT INTO collection_rounds (status, pipeline_version) VALUES (?, ?)')
      .run('completed', 'v1-test');
    roundId = Number(round.lastInsertRowid);

    const raw = db
      .prepare(
        `INSERT INTO raw_items
          (collection_round_id, source_type, source_id, source_name, external_id, title, published_at, collected_at, url, excerpt_or_summary, author, language, timestamp_quality)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        roundId,
        'social',
        'source-1',
        'Source One',
        'external-1',
        'Title 1',
        null,
        createdAtUtcIso,
        'https://example.com/item-1',
        'Some summary',
        null,
        'en',
        'missing',
      );

    const rawItemId = Number(raw.lastInsertRowid);

    db
      .prepare(
        `INSERT INTO normalized_items
          (collection_round_id, raw_item_id, extractor_version, source_type, source_id, external_id, title, published_at, url, author, language, timestamp_quality, content_text_or_excerpt, content_summary, created_at_utc)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        roundId,
        rawItemId,
        'v1-test',
        'social',
        'source-1',
        'external-1',
        'Title 1',
        null,
        'https://example.com/item-1',
        null,
        'en',
        'missing',
        'Some summary',
        'Some summary',
        createdAtUtcIso,
      );
  });

  afterAll(() => {
    db.close();
  });

  it('isoWeekBucket should be deterministic for a fixed utc date', () => {
    const bucket1 = isoWeekBucket('2026-03-20T12:34:56.000Z');
    const bucket2 = isoWeekBucket('2026-03-20T12:34:56.000Z');
    expect(bucket1).toBe('2026-W12');
    expect(bucket2).toBe(bucket1);
  });

  it('clusterId should be deterministic for the same inputs', () => {
    const sig = canonicalSignatureForItem({
      created_at_utc: '2026-03-20T12:34:56.000Z',
      source_type: 'social',
      language: 'en',
      source_id: 'source-1',
    });

    const id1 = clusterId(sig, 'v1');
    const id2 = clusterId(sig, 'v1');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('clusterKindFromDeltas should hit event_update boundaries', () => {
    expect(clusterKindFromDeltas({ conclusion_delta: 0.6 })).toBe('event_update');
    expect(clusterKindFromDeltas({ conflict_delta: 0.5 })).toBe('event_update');
    expect(clusterKindFromDeltas({ conclusion_delta: 0.59, conflict_delta: 0.49 })).toBe('topic_drift');
    expect(clusterKindFromDeltas({})).toBe('topic_drift');
  });

  it('representative freeze: second clusterNormalizedItemsForRound call should not change representative_cluster_id/canonical_signature', async () => {
    await clusterNormalizedItemsForRound(db, roundId, nowUtcIso);

    const before = db
      .prepare('SELECT cluster_id, representative_cluster_id, canonical_signature FROM clusters')
      .get() as { cluster_id: string; representative_cluster_id: string; canonical_signature: string };

    await clusterNormalizedItemsForRound(db, roundId, nowUtcIso);

    const after = db
      .prepare('SELECT cluster_id, representative_cluster_id, canonical_signature FROM clusters')
      .get() as { cluster_id: string; representative_cluster_id: string; canonical_signature: string };

    expect(after.cluster_id).toBe(before.cluster_id);
    expect(after.representative_cluster_id).toBe(before.representative_cluster_id);
    expect(after.canonical_signature).toBe(before.canonical_signature);
  });
});

