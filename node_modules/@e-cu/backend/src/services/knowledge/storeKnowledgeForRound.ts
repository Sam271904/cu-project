import type Database from 'better-sqlite3';

import { truncateWithEllipsis } from '../normalize/normalizeText';

function labelFromSummary(summary: string): string {
  const m = summary.match(/[A-Za-z0-9][A-Za-z0-9_-]+/);
  if (m) return m[0].slice(0, 24);
  // Fallback for CJK: take first 8 chars.
  return summary.slice(0, 8);
}

export async function storeKnowledgeForRound(db: Database.Database, roundId: number): Promise<void> {
  const clusters: Array<{ cluster_id: string }> = db
    .prepare(
      `
      SELECT DISTINCT c.cluster_id
      FROM clusters c
      JOIN cluster_evidence ce ON ce.cluster_id = c.cluster_id
      JOIN normalized_items n ON n.id = ce.normalized_item_id
      WHERE n.collection_round_id = ?
      ORDER BY c.cluster_id ASC
      `
    )
    .all(roundId) as Array<{ cluster_id: string }>;

  const stmtLoadSignals = db.prepare(
    `SELECT signals_json FROM decision_signals WHERE cluster_id = ?`
  );

  const stmtUpsert = db.prepare(
    `
    INSERT OR REPLACE INTO knowledge_entries
      (cluster_id, content_summary, snippet_text, tags_json, entry_json)
    VALUES
      (?, ?, ?, ?, ?)
    `
  );

  for (const c of clusters) {
    const row = stmtLoadSignals.get(c.cluster_id) as { signals_json: string } | undefined;
    if (!row) continue;

    const signals = JSON.parse(row.signals_json) as any;

    const changeSummary = String(signals?.change?.change_summary ?? '');
    const evidenceLink0 = signals?.change?.evidence_links?.[0] ?? null;
    const snippetText = String(evidenceLink0?.evidence_snippet?.snippet_text ?? changeSummary);

    const tag = labelFromSummary(changeSummary || snippetText || c.cluster_id);
    const tags = [`topic:${tag}`];

    stmtUpsert.run(
      c.cluster_id,
      changeSummary,
      truncateWithEllipsis(snippetText, 600),
      JSON.stringify(tags),
      row.signals_json
    );
  }
}

