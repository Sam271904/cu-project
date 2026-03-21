import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from '../src/db/db';
import {
  clusterNormalizedItemsForRound,
  resolveEvidenceRootClusterId,
} from '../src/services/cluster/clusterNormalizedItemsForRound';

function insertRawAndNormalized(
  db: Database.Database,
  roundId: number,
  opts: {
    source_id: string;
    external_id: string;
    content_summary: string;
    created_at_utc: string;
  },
) {
  const raw = db
    .prepare(
      `INSERT INTO raw_items
        (collection_round_id, source_type, source_id, source_name, external_id, title, published_at, collected_at, url, excerpt_or_summary, author, language, timestamp_quality)
      VALUES (?, 'social', ?, 'S', ?, 'T', NULL, ?, 'https://example.com/x', ?, NULL, 'en', 'missing')`,
    )
    .run(roundId, opts.source_id, opts.external_id, opts.created_at_utc, opts.content_summary);
  const rawId = Number(raw.lastInsertRowid);
  db.prepare(
    `INSERT INTO normalized_items
      (collection_round_id, raw_item_id, extractor_version, source_type, source_id, external_id, title, published_at, url, author, language, timestamp_quality, content_text_or_excerpt, content_summary, created_at_utc)
     VALUES (?, ?, 'v1', 'social', ?, ?, 'T', NULL, 'https://example.com/x', NULL, 'en', 'missing', ?, ?, ?)`,
  ).run(
    roundId,
    rawId,
    opts.source_id,
    opts.external_id,
    opts.content_summary,
    opts.content_summary,
    opts.created_at_utc,
  );
}

describe('cluster merge by Jaccard > 0.7 (Task 5.2)', () => {
  let db: Database.Database;
  let dbPath = '';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `e-cu-merge-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env.DATABASE_URL = `sqlite:${dbPath}`;
    db = openDb({ databaseUrl: process.env.DATABASE_URL });
  });

  afterEach(() => {
    db.close();
  });

  it('merges two different canonical clusters when summaries strongly overlap', async () => {
    const round = db.prepare(`INSERT INTO collection_rounds (status, pipeline_version) VALUES ('done','v1')`).run();
    const roundId = Number(round.lastInsertRowid);
    const t = '2026-03-20T12:00:00.000Z';

    const shared =
      'inflation outlook monetary policy rates guidance labor market stability forecast horizon medium term';
    insertRawAndNormalized(db, roundId, {
      source_id: 'feed-a',
      external_id: 'e-a',
      content_summary: shared,
      created_at_utc: t,
    });
    insertRawAndNormalized(db, roundId, {
      source_id: 'feed-b',
      external_id: 'e-b',
      content_summary: `${shared} extra tail phrase`,
      created_at_utc: t,
    });

    await clusterNormalizedItemsForRound(db, roundId, t);

    const evidence = db.prepare(`SELECT cluster_id, normalized_item_id FROM cluster_evidence ORDER BY normalized_item_id ASC`).all() as Array<{
      cluster_id: string;
      normalized_item_id: number;
    }>;
    expect(evidence).toHaveLength(2);
    const roots = new Set(evidence.map((e) => e.cluster_id));
    expect(roots.size).toBe(1);

    const clusters = db.prepare(`SELECT cluster_id, representative_cluster_id FROM clusters ORDER BY cluster_id ASC`).all() as Array<{
      cluster_id: string;
      representative_cluster_id: string;
    }>;
    expect(clusters.length).toBe(2);
    const rootId = [...roots][0]!;
    for (const c of clusters) {
      expect(resolveEvidenceRootClusterId(db, c.cluster_id)).toBe(rootId);
    }
    const aliasRow = clusters.find((c) => c.cluster_id !== c.representative_cluster_id);
    expect(aliasRow).toBeTruthy();
    expect(aliasRow!.representative_cluster_id).toBe(rootId);
  });

  it('does not merge when summaries are disjoint', async () => {
    const round = db.prepare(`INSERT INTO collection_rounds (status, pipeline_version) VALUES ('done','v1')`).run();
    const roundId = Number(round.lastInsertRowid);
    const t = '2026-03-21T12:00:00.000Z';

    insertRawAndNormalized(db, roundId, {
      source_id: 'feed-x',
      external_id: 'x1',
      content_summary: 'quantum chromodynamics lattice gauge simulation',
      created_at_utc: t,
    });
    insertRawAndNormalized(db, roundId, {
      source_id: 'feed-y',
      external_id: 'y1',
      content_summary: 'baking sourdough fermentation hydration scoring',
      created_at_utc: t,
    });

    await clusterNormalizedItemsForRound(db, roundId, t);

    const evidence = db.prepare(`SELECT DISTINCT cluster_id FROM cluster_evidence`).all() as Array<{ cluster_id: string }>;
    expect(evidence).toHaveLength(2);
  });

  it('splits root after two consecutive low-overlap bipartition checks (N=2), including empty-normalized round', async () => {
    const t = '2026-03-22T12:00:00.000Z';

    const r1 = db.prepare(`INSERT INTO collection_rounds (status, pipeline_version) VALUES ('done','v1')`).run();
    const roundId1 = Number(r1.lastInsertRowid);

    insertRawAndNormalized(db, roundId1, {
      source_id: 'feed-split',
      external_id: 's-a',
      content_summary: 'quantum chromodynamics lattice gauge simulation particles',
      created_at_utc: t,
    });
    insertRawAndNormalized(db, roundId1, {
      source_id: 'feed-split',
      external_id: 's-b',
      content_summary: 'baking sourdough fermentation hydration scoring crust',
      created_at_utc: t,
    });

    await clusterNormalizedItemsForRound(db, roundId1, t);

    const streak1 = db
      .prepare(`SELECT low_overlap_streak FROM cluster_split_state WHERE root_cluster_id = (SELECT cluster_id FROM cluster_evidence LIMIT 1)`)
      .get() as { low_overlap_streak: number } | undefined;
    expect(streak1?.low_overlap_streak).toBe(1);

    const r2 = db.prepare(`INSERT INTO collection_rounds (status, pipeline_version) VALUES ('done','v1')`).run();
    const roundId2 = Number(r2.lastInsertRowid);

    await clusterNormalizedItemsForRound(db, roundId2, t);

    const parents = db.prepare(`SELECT child_cluster_id, parent_cluster_id FROM cluster_parents`).all() as Array<{
      child_cluster_id: string;
      parent_cluster_id: string;
    }>;
    expect(parents).toHaveLength(1);

    const roots = db
      .prepare(
        `SELECT cluster_id FROM clusters WHERE cluster_id = representative_cluster_id ORDER BY cluster_id ASC`,
      )
      .all() as Array<{ cluster_id: string }>;
    expect(roots.length).toBe(2);

    const evidenceRows = db
      .prepare(`SELECT cluster_id, normalized_item_id FROM cluster_evidence ORDER BY normalized_item_id ASC`)
      .all() as Array<{ cluster_id: string; normalized_item_id: number }>;
    expect(evidenceRows).toHaveLength(2);
    expect(new Set(evidenceRows.map((e) => e.cluster_id)).size).toBe(2);
  });
});
