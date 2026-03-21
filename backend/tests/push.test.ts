import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';

import { openDb } from '../src/db/db';
import { computeAndStoreNotificationsForRound } from '../src/services/notifications/computeNotificationsForRound';

function createRound(db: Database.Database, idHint?: number): number {
  const row = db
    .prepare(`INSERT INTO collection_rounds (status, pipeline_version) VALUES ('done', 'v1')`)
    .run();
  return Number(row.lastInsertRowid ?? idHint ?? 0);
}

function seedClusterAndEvidence(db: Database.Database, opts: { roundId: number; clusterId: string; nid: number }) {
  const t = '2026-03-20T00:00:00.000Z';
  db.prepare(
    `INSERT OR IGNORE INTO clusters
      (cluster_id, representative_cluster_id, created_at_utc, canonical_signature, clustering_model_version)
     VALUES (?, ?, ?, ?, 'v1')`,
  ).run(opts.clusterId, opts.clusterId, t, `sig|${opts.clusterId}`);

  db.prepare(
    `INSERT INTO raw_items
      (id, collection_round_id, source_type, source_id, source_name, external_id, title, published_at, collected_at, url, excerpt_or_summary, author, language, timestamp_quality)
     VALUES (?, ?, 'social', 's1', 'S', ?, 'T', NULL, ?, ?, 'excerpt', NULL, 'en', 'missing')`,
  ).run(opts.nid, opts.roundId, `ext-${opts.nid}`, t, `https://example.com/${opts.nid}`);

  db.prepare(
    `INSERT INTO normalized_items
      (id, collection_round_id, raw_item_id, extractor_version, source_type, source_id, external_id, title, published_at, url, author, language, timestamp_quality, content_text_or_excerpt, content_summary, created_at_utc)
     VALUES (?, ?, ?, 'v1', 'social', 's1', ?, 'T', NULL, ?, NULL, 'en', 'missing', ?, ?, ?)`,
  ).run(
    opts.nid,
    opts.roundId,
    opts.nid,
    `ext-${opts.nid}`,
    `https://example.com/${opts.nid}`,
    `body-${opts.nid}`,
    `summary-${opts.nid}`,
    t,
  );

  db.prepare(`INSERT INTO cluster_evidence (cluster_id, normalized_item_id) VALUES (?, ?)`).run(
    opts.clusterId,
    opts.nid,
  );
}

function seedDecisionSignals(
  db: Database.Database,
  opts: { clusterId: string; nid: number; snippet: string; changeSummary: string },
) {
  const signals = {
    cluster_id: opts.clusterId,
    signal_schema_version: 'v1-signals-0',
    change_policy_used: 'LATEST_WINS',
    change: {
      evidence_links: [
        {
          evidence_ref: {
            normalized_item_id: String(opts.nid),
            url: `https://example.com/${opts.nid}`,
            published_at: '2026-03-20T00:00:00.000Z',
            extractor_version: 'v1-evidence-from-normalized-0',
            confidence: 0.9,
            extracted_spans: [],
          },
          evidence_snippet: {
            snippet_text: opts.snippet,
            snippet_language: 'en',
            extractor_version: 'v1-evidence-from-normalized-0',
          },
          role: 'supports',
          link_confidence: 0.9,
        },
      ],
      change_policy_used: 'LATEST_WINS',
      change_summary: opts.changeSummary,
      change_type: 'added',
    },
    risk: {
      evidence_links: [],
      change_policy_used: 'LATEST_WINS',
      risk_summary: 'risk',
    },
    opportunity: {
      evidence_links: [],
      change_policy_used: 'LATEST_WINS',
      opportunity_summary: 'opp',
    },
    disagreement: {
      evidence_links: [],
      change_policy_used: 'LATEST_WINS',
      dispute_summary: 'disp',
      sides: ['A', 'B'],
      coverage_gaps: [],
    },
  };

  db.prepare(
    `INSERT OR REPLACE INTO decision_signals (cluster_id, signal_schema_version, change_policy_used, signals_json)
     VALUES (?, ?, ?, ?)`,
  ).run(opts.clusterId, 'v1-signals-0', 'LATEST_WINS', JSON.stringify(signals));
}

function seedTimeline(
  db: Database.Database,
  opts: {
    roundId: number;
    clusterId: string;
    clusterKind: 'event_update' | 'topic_drift';
    evidenceRefIds: string[];
    claimHash: string;
    conflictStrength: number;
  },
) {
  db.prepare(
    `INSERT INTO cluster_timeline_state
      (collection_round_id, cluster_id, evidence_set_hash, cluster_kind, evidence_ref_ids_json, claim_text_hash, conflict_strength)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.roundId,
    opts.clusterId,
    `h-${opts.roundId}`,
    opts.clusterKind,
    JSON.stringify(opts.evidenceRefIds),
    opts.claimHash,
    opts.conflictStrength,
  );
}

describe('push integration matrix (Task 8.2 Step 7)', () => {
  let db: Database.Database;
  let dbPath = '';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `e-cu-push-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env.DATABASE_URL = `sqlite:${dbPath}`;
    db = openDb({ databaseUrl: process.env.DATABASE_URL });
  });

  afterEach(() => {
    db.close();
  });

  it('dedup within 7 days blocks repeat, after 7 days allows', async () => {
    const cid = 'c-dedup';
    const r1 = createRound(db);
    seedClusterAndEvidence(db, { roundId: r1, clusterId: cid, nid: 1001 });
    seedDecisionSignals(db, { clusterId: cid, nid: 1001, snippet: 's1', changeSummary: 'same summary' });
    seedTimeline(db, {
      roundId: r1,
      clusterId: cid,
      clusterKind: 'event_update',
      evidenceRefIds: ['1001|v1-evidence-from-normalized-0'],
      claimHash: 'h1',
      conflictStrength: 0,
    });

    const first = await computeAndStoreNotificationsForRound(db, r1, '2026-03-02T00:00:00.000Z');
    expect(first.high + first.medium).toBe(1);

    db.prepare(`UPDATE notification_event_log SET created_at_utc = ?`).run('2026-03-01T00:00:00.000Z');

    const r2 = createRound(db);
    seedClusterAndEvidence(db, { roundId: r2, clusterId: cid, nid: 1002 });
    seedDecisionSignals(db, { clusterId: cid, nid: 1001, snippet: 's1 changed', changeSummary: 'same summary' });
    // keep fingerprint same: same evidence_ref_ids in signals_json (nid 1001), same struct/policy/type
    seedTimeline(db, {
      roundId: r2,
      clusterId: cid,
      clusterKind: 'event_update',
      evidenceRefIds: ['1002|v1-evidence-from-normalized-0'],
      claimHash: 'h2',
      conflictStrength: 1,
    });

    const second = await computeAndStoreNotificationsForRound(db, r2, '2026-03-05T00:00:00.000Z');
    expect(second.high + second.medium).toBe(0);

    const third = await computeAndStoreNotificationsForRound(db, r2, '2026-03-10T00:00:00.000Z');
    expect(third.high + third.medium).toBe(1);
  });

  it('payload keeps strict keyset and excludes snippet_text', async () => {
    const cid = 'c-payload';
    const r1 = createRound(db);
    seedClusterAndEvidence(db, { roundId: r1, clusterId: cid, nid: 1101 });
    seedDecisionSignals(db, { clusterId: cid, nid: 1101, snippet: 'private snippet', changeSummary: 'public summary' });
    seedTimeline(db, {
      roundId: r1,
      clusterId: cid,
      clusterKind: 'event_update',
      evidenceRefIds: ['1101|v1-evidence-from-normalized-0'],
      claimHash: 'h1',
      conflictStrength: 0,
    });

    await computeAndStoreNotificationsForRound(db, r1, '2026-03-02T00:00:00.000Z');
    const row = db.prepare(`SELECT payload_json FROM notification_event_log ORDER BY id DESC LIMIT 1`).get() as {
      payload_json: string;
    };
    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['event_key', 'reminder_level', 'short_summary', 'title']);
    expect(JSON.stringify(payload)).not.toContain('snippet_text');
  });

  it('topic_drift with high but non-dominant conflict is blocked', async () => {
    const cid = 'c-topic-block';
    const r1 = createRound(db);
    seedClusterAndEvidence(db, { roundId: r1, clusterId: cid, nid: 1201 });
    seedDecisionSignals(db, { clusterId: cid, nid: 1201, snippet: 'x', changeSummary: 'x' });
    // high score by novelty+conclusion (0.8), but conflict delta 0 => non-dominant
    seedTimeline(db, {
      roundId: r1,
      clusterId: cid,
      clusterKind: 'topic_drift',
      evidenceRefIds: ['1201|v1-evidence-from-normalized-0'],
      claimHash: 'h1',
      conflictStrength: 0,
    });

    const out = await computeAndStoreNotificationsForRound(db, r1, '2026-03-02T00:00:00.000Z');
    expect(out.high + out.medium).toBe(0);
  });

  it('short_summary remains stable when only evidence snippet changes', async () => {
    const cid = 'c-summary-stable';
    const r1 = createRound(db);
    seedClusterAndEvidence(db, { roundId: r1, clusterId: cid, nid: 1301 });
    seedDecisionSignals(db, {
      clusterId: cid,
      nid: 1301,
      snippet: 'snippet-v1',
      changeSummary: 'stable summary',
    });
    seedTimeline(db, {
      roundId: r1,
      clusterId: cid,
      clusterKind: 'event_update',
      evidenceRefIds: ['1301|v1-evidence-from-normalized-0'],
      claimHash: 'h1',
      conflictStrength: 0,
    });
    await computeAndStoreNotificationsForRound(db, r1, '2026-03-02T00:00:00.000Z');
    db.prepare(`UPDATE notification_event_log SET created_at_utc = ?`).run('2026-02-20T00:00:00.000Z');

    const r2 = createRound(db);
    seedClusterAndEvidence(db, { roundId: r2, clusterId: cid, nid: 1302 });
    // only snippet changed; change_summary unchanged
    seedDecisionSignals(db, {
      clusterId: cid,
      nid: 1302,
      snippet: 'snippet-v2 changed only',
      changeSummary: 'stable summary',
    });
    seedTimeline(db, {
      roundId: r2,
      clusterId: cid,
      clusterKind: 'event_update',
      evidenceRefIds: ['1302|v1-evidence-from-normalized-0'],
      claimHash: 'h1',
      conflictStrength: 1,
    });
    await computeAndStoreNotificationsForRound(db, r2, '2026-03-20T00:00:00.000Z');

    const rows = db
      .prepare(`SELECT payload_json FROM notification_event_log ORDER BY id ASC`)
      .all() as Array<{ payload_json: string }>;
    expect(rows.length).toBe(2);
    const p1 = JSON.parse(rows[0]!.payload_json) as { short_summary: string };
    const p2 = JSON.parse(rows[1]!.payload_json) as { short_summary: string };
    expect(p1.short_summary).toBe('stable summary');
    expect(p2.short_summary).toBe('stable summary');
  });
});
