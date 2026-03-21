import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from '../src/db/db';
import { clusterNormalizedItemsForRound } from '../src/services/cluster/clusterNormalizedItemsForRound';
import { extractSignalsForRound } from '../src/services/signal_extraction/extractSignalsForRound';

describe('extractSignalsForRound mock overlay (Task 6.2)', () => {
  let db: Database.Database;
  let dbPath = '';
  let roundId = 0;
  const t = '2026-03-20T12:34:56.000Z';

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `e-cu-mocksig-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env.DATABASE_URL = `sqlite:${dbPath}`;
    db = openDb({ databaseUrl: process.env.DATABASE_URL });

    const round = db.prepare(`INSERT INTO collection_rounds (status, pipeline_version) VALUES ('done','v1')`).run();
    roundId = Number(round.lastInsertRowid);

    const raw = db
      .prepare(
        `INSERT INTO raw_items
          (collection_round_id, source_type, source_id, source_name, external_id, title, published_at, collected_at, url, excerpt_or_summary, author, language, timestamp_quality)
        VALUES (?, 'social', 's1', 'S', 'e1', 'T', NULL, ?, 'https://example.com/a', 'body', NULL, 'en', 'missing')`,
      )
      .run(roundId, t);
    const rawId = Number(raw.lastInsertRowid);
    db.prepare(
      `INSERT INTO normalized_items
        (collection_round_id, raw_item_id, extractor_version, source_type, source_id, external_id, title, published_at, url, author, language, timestamp_quality, content_text_or_excerpt, content_summary, created_at_utc)
       VALUES (?, ?, 'v1', 'social', 's1', 'e1', 'T', NULL, 'https://example.com/a', NULL, 'en', 'missing', 'body', 'Label for mock', ?)`,
    ).run(roundId, rawId, t);
  });

  afterAll(() => {
    db.close();
  });

  it('default build has no mock prefix', async () => {
    await clusterNormalizedItemsForRound(db, roundId, t);
    await extractSignalsForRound(db, roundId, 'en', { forceMockOverlay: false });
    const row = db.prepare(`SELECT signals_json FROM decision_signals LIMIT 1`).get() as { signals_json: string };
    const j = JSON.parse(row.signals_json) as { change?: { change_summary?: string } };
    expect(j.change?.change_summary ?? '').not.toMatch(/^\[mock_llm\]/);
  });

  it('forceMockOverlay prefixes structured summaries', async () => {
    await clusterNormalizedItemsForRound(db, roundId, t);
    await extractSignalsForRound(db, roundId, 'en', { forceMockOverlay: true });
    const row = db.prepare(`SELECT signals_json FROM decision_signals LIMIT 1`).get() as { signals_json: string };
    const j = JSON.parse(row.signals_json) as { change?: { change_summary?: string } };
    expect(j.change?.change_summary ?? '').toMatch(/^\[mock_llm\]/);
  });
});
