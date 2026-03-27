import type Database from 'better-sqlite3';
import { computeHnSignal } from './scoreCluster';

/**
 * Looks up the best HN signal for a cluster by joining
 * cluster_evidence → normalized_items → raw_items (source_type='hn')
 * and taking the max hn_signal across all HN items in the cluster.
 * Returns null if no HN items are in this cluster.
 */
export function loadHnSignalForCluster(
  db: Database.Database,
  clusterId: string,
): number | null {
  const rows = db.prepare(`
    SELECT r.source_metadata_json
    FROM cluster_evidence ce
    JOIN normalized_items ni ON ni.id = ce.normalized_item_id
    JOIN raw_items r ON r.id = ni.raw_item_id
    WHERE ce.cluster_id = ? AND r.source_type = 'hn'
  `).all(clusterId) as Array<{ source_metadata_json: string }>;

  if (rows.length === 0) return null;

  let bestSignal: number | null = null;
  for (const row of rows) {
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(row.source_metadata_json ?? '{}');
    } catch {
      continue;
    }
    const position = typeof meta.position === 'number' ? meta.position : 100;
    const velocity = typeof meta.velocity === 'number' ? meta.velocity : null;
    const sig = computeHnSignal(velocity, position);
    if (sig !== null && (bestSignal === null || sig > bestSignal)) {
      bestSignal = sig;
    }
  }
  return bestSignal;
}