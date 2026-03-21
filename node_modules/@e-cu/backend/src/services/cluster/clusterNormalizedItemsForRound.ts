import type Database from 'better-sqlite3';
import crypto from 'node:crypto';

import {
  MERGE_JACCARD_THRESHOLD,
  jaccardSimilarity,
  mergeUnionSets,
  tokenizeContentSummary,
} from './mergeUtils';
import { maybeSplitClustersAfterRound } from './splitClusters';

export function isoWeekBucket(utcIso: string): string {
  // ISO week number in UTC: bucket = YYYY-Www
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid utcIso: ${utcIso}`);

  // Move to Thursday of this week to derive ISO week-year.
  const tmp = new Date(d.getTime());
  const day = tmp.getUTCDay() || 7; // Sun=0 -> 7, Mon=1..Sat=6
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);

  const isoYear = tmp.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1); // Jan 1 UTC
  const week = Math.ceil(((tmp.getTime() - yearStart) / 86400000 + 1) / 7);

  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export type CanonicalSignatureForItemInput = {
  created_at_utc: string;
  source_type: string;
  language: string;
  source_id: string;
};

export function canonicalSignatureForItem({
  created_at_utc,
  source_type,
  language,
  source_id,
}: CanonicalSignatureForItemInput): string {
  // v1 deterministic signature: stable across evidence updates for the same source/week.
  return `${isoWeekBucket(created_at_utc)}|${source_type}|${language}|${source_id}`;
}

export function clusterId(canonical_signature: string, clustering_model_version: string): string {
  const input = `${canonical_signature}|${clustering_model_version}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

export type ClusterKindDeltas = {
  conclusion_delta?: number;
  conflict_delta?: number;
};

export function clusterKindFromDeltas({ conclusion_delta, conflict_delta }: ClusterKindDeltas): string {
  if (conclusion_delta === undefined && conflict_delta === undefined) return 'topic_drift';
  if (conclusion_delta !== undefined && conclusion_delta >= 0.6) return 'event_update';
  if (conflict_delta !== undefined && conflict_delta >= 0.5) return 'event_update';
  return 'topic_drift';
}

/** Follow representative_cluster_id chain to storage root (evidence lives here). */
export function resolveEvidenceRootClusterId(db: Database.Database, clusterId: string): string {
  const seen = new Set<string>();
  let cur = clusterId;
  for (;;) {
    if (seen.has(cur)) return clusterId;
    seen.add(cur);
    const row = db
      .prepare(`SELECT cluster_id, representative_cluster_id FROM clusters WHERE cluster_id = ?`)
      .get(cur) as { cluster_id: string; representative_cluster_id: string } | undefined;
    if (!row) return cur;
    if (row.representative_cluster_id === row.cluster_id) return row.cluster_id;
    cur = row.representative_cluster_id;
  }
}

function listEvidenceRootClusterIds(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `
      SELECT cluster_id
      FROM clusters
      WHERE cluster_id = representative_cluster_id
      ORDER BY cluster_id ASC
      `,
    )
    .all() as Array<{ cluster_id: string }>;
  return rows.map((r) => r.cluster_id);
}

function loadTokenUnionForRoot(db: Database.Database, rootId: string): Set<string> {
  const rows = db
    .prepare(
      `
      SELECT n.content_summary
      FROM cluster_evidence ce
      JOIN normalized_items n ON n.id = ce.normalized_item_id
      WHERE ce.cluster_id = ?
      `,
    )
    .all(rootId) as Array<{ content_summary: string }>;

  const acc = new Set<string>();
  for (const r of rows) {
    mergeUnionSets(acc, tokenizeContentSummary(r.content_summary));
  }
  return acc;
}

export async function clusterNormalizedItemsForRound(
  db: Database.Database,
  roundId: number,
  _nowUtcIso: string,
): Promise<void> {
  const clustering_model_version = 'v1';

  const normalized = db
    .prepare(
      `
      SELECT
        id as normalized_item_id,
        created_at_utc,
        source_type,
        source_id,
        language,
        content_summary
      FROM normalized_items
      WHERE collection_round_id = ?
      ORDER BY id ASC
      `,
    )
    .all(roundId) as Array<{
    normalized_item_id: number;
    created_at_utc: string;
    source_type: string;
    source_id: string;
    language: string;
    content_summary: string;
  }>;

  const insertCluster = db.prepare(
    `
    INSERT OR IGNORE INTO clusters
      (cluster_id, representative_cluster_id, created_at_utc, canonical_signature, clustering_model_version)
    VALUES
      (?, ?, ?, ?, ?)
    `,
  );

  const insertEvidence = db.prepare(
    `
    INSERT OR IGNORE INTO cluster_evidence (cluster_id, normalized_item_id)
    VALUES
      (?, ?)
    `,
  );

  /** In-memory union per evidence root for this process (speed + same-round updates). */
  const tokenUnionByRoot = new Map<string, Set<string>>();

  function getUnion(rootId: string): Set<string> {
    let u = tokenUnionByRoot.get(rootId);
    if (!u) {
      u = loadTokenUnionForRoot(db, rootId);
      tokenUnionByRoot.set(rootId, u);
    }
    return u;
  }

  for (const n of normalized) {
    const canonical_signature = canonicalSignatureForItem({
      created_at_utc: n.created_at_utc,
      source_type: n.source_type,
      language: n.language,
      source_id: n.source_id,
    });

    const cid = clusterId(canonical_signature, clustering_model_version);

    const existingRow = db
      .prepare(`SELECT representative_cluster_id FROM clusters WHERE cluster_id = ?`)
      .get(cid) as { representative_cluster_id: string } | undefined;

    if (existingRow) {
      const root = resolveEvidenceRootClusterId(db, cid);
      insertEvidence.run(root, n.normalized_item_id);
      mergeUnionSets(getUnion(root), tokenizeContentSummary(n.content_summary));
      continue;
    }

    const itemTokens = tokenizeContentSummary(n.content_summary);
    let bestJ = 0;
    let bestRoot: string | null = null;

    for (const rootId of listEvidenceRootClusterIds(db)) {
      if (rootId === cid) continue;
      const union = getUnion(rootId);
      const j = jaccardSimilarity(itemTokens, union);
      if (j > bestJ) {
        bestJ = j;
        bestRoot = rootId;
      }
    }

    // v1 MVP: merge into existing root when similarity exceeds threshold (no reparenting of older roots).
    const mergeInto =
      bestRoot !== null && bestJ > MERGE_JACCARD_THRESHOLD ? bestRoot : cid;
    const rep = mergeInto;

    insertCluster.run(cid, rep, n.created_at_utc, canonical_signature, clustering_model_version);
    insertEvidence.run(rep, n.normalized_item_id);
    mergeUnionSets(getUnion(rep), itemTokens);
  }

  maybeSplitClustersAfterRound(db, roundId, _nowUtcIso);
}
