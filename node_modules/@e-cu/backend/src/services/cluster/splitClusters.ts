import type Database from 'better-sqlite3';
import crypto from 'node:crypto';

import {
  SPLIT_JACCARD_THRESHOLD,
  minBipartitionJaccard,
  tokenizeContentSummary,
  type TokenizedItem,
} from './mergeUtils';

function deterministicSplitChildClusterId(parentClusterId: string, rightNormalizedIds: number[]): string {
  const sorted = [...rightNormalizedIds].sort((a, b) => a - b);
  const input = `split|v1|${parentClusterId}|${sorted.join(',')}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

function listSplittableRootClusterIds(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `
      SELECT c.cluster_id
      FROM clusters c
      JOIN cluster_evidence ce ON ce.cluster_id = c.cluster_id
      WHERE c.cluster_id = c.representative_cluster_id
      GROUP BY c.cluster_id
      HAVING COUNT(*) >= 2
      ORDER BY c.cluster_id ASC
      `,
    )
    .all() as Array<{ cluster_id: string }>;
  return rows.map((r) => r.cluster_id);
}

function loadEvidenceTokenizedItems(db: Database.Database, rootId: string): TokenizedItem[] {
  const rows = db
    .prepare(
      `
      SELECT ce.normalized_item_id AS id, n.content_summary
      FROM cluster_evidence ce
      JOIN normalized_items n ON n.id = ce.normalized_item_id
      WHERE ce.cluster_id = ?
      ORDER BY ce.normalized_item_id ASC
      `,
    )
    .all(rootId) as Array<{ id: number; content_summary: string }>;

  return rows.map((r) => ({
    id: r.id,
    tokens: tokenizeContentSummary(r.content_summary),
  }));
}

/**
 * Task 5.2 Step 4: split when best bipartition Jaccard < 0.4 for two consecutive rounds (N=2).
 * Runs after evidence for this round is attached; must run even when this round has zero new normalized rows.
 */
export function maybeSplitClustersAfterRound(
  db: Database.Database,
  roundId: number,
  nowUtcIso: string,
): void {
  const upsertState = db.prepare(
    `
    INSERT INTO cluster_split_state (root_cluster_id, low_overlap_streak, last_round_id)
    VALUES (@root, @streak, @lastRound)
    ON CONFLICT(root_cluster_id) DO UPDATE SET
      low_overlap_streak = excluded.low_overlap_streak,
      last_round_id = excluded.last_round_id
    `,
  );

  const insertCluster = db.prepare(
    `
    INSERT OR IGNORE INTO clusters
      (cluster_id, representative_cluster_id, created_at_utc, canonical_signature, clustering_model_version)
    VALUES (?, ?, ?, ?, 'v1')
    `,
  );

  const insertParent = db.prepare(
    `
    INSERT OR IGNORE INTO cluster_parents (child_cluster_id, parent_cluster_id)
    VALUES (?, ?)
    `,
  );

  const moveEvidence = db.prepare(
    `
    UPDATE cluster_evidence
    SET cluster_id = @childId
    WHERE cluster_id = @parentId AND normalized_item_id = @nid
    `,
  );

  const roots = listSplittableRootClusterIds(db);

  for (const rootId of roots) {
    const sortedItems = loadEvidenceTokenizedItems(db, rootId);
    if (sortedItems.length < 2) continue;

    const { minJ, bestK } = minBipartitionJaccard(sortedItems);

    const state = db
      .prepare(
        `SELECT low_overlap_streak, last_round_id FROM cluster_split_state WHERE root_cluster_id = ?`,
      )
      .get(rootId) as { low_overlap_streak: number; last_round_id: number | null } | undefined;

    let streak = state?.low_overlap_streak ?? 0;
    const lastRoundId = state?.last_round_id ?? null;

    if (minJ >= SPLIT_JACCARD_THRESHOLD) {
      upsertState.run({ root: rootId, streak: 0, lastRound: roundId });
      continue;
    }

    // Low overlap this check
    if (lastRoundId === roundId) {
      // Already applied streak update for this round (idempotent re-entry).
      continue;
    }

    streak += 1;
    upsertState.run({ root: rootId, streak, lastRound: roundId });

    if (streak < 2) continue;

    const sortedIds = sortedItems.map((x) => x.id);
    const rightIds = sortedIds.slice(bestK);
    if (rightIds.length === 0 || rightIds.length === sortedIds.length) continue;

    const childId = deterministicSplitChildClusterId(rootId, rightIds);
    const canonicalSignature = `split|v1|${rootId}|${rightIds.join(',')}`;

    const tx = db.transaction(() => {
      insertCluster.run(childId, childId, nowUtcIso, canonicalSignature);
      insertParent.run(childId, rootId);

      for (const nid of rightIds) {
        moveEvidence.run({ childId, parentId: rootId, nid });
      }

      upsertState.run({ root: rootId, streak: 0, lastRound: roundId });
      upsertState.run({ root: childId, streak: 0, lastRound: null });
    });

    tx();
  }
}
