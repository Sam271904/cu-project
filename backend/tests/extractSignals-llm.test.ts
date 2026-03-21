import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from '../src/db/db';
import { clusterNormalizedItemsForRound } from '../src/services/cluster/clusterNormalizedItemsForRound';
import { extractSignalsForRound } from '../src/services/signal_extraction/extractSignalsForRound';

describe('extractSignalsForRound openai_compatible (Task 6.2 LLM)', () => {
  let db: Database.Database;
  let dbPath = '';
  let roundId = 0;
  const t = '2026-03-20T12:34:56.000Z';

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `e-cu-llmsig-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
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
       VALUES (?, ?, 'v1', 'social', 's1', 'e1', 'T', NULL, 'https://example.com/a', NULL, 'en', 'missing', 'body text excerpt', 'Label for LLM', ?)`,
    ).run(roundId, rawId, t);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    process.env.PIH_SIGNAL_EXTRACTOR = 'openai_compatible';
    process.env.PIH_LLM_API_KEY = 'sk-test';
    delete process.env.PIH_LLM_BASE_URL;
    process.env.PIH_LLM_MODEL = 'm';
    const llmJson = JSON.stringify({
      change_summary: 'LLM_CHANGE',
      change_type: 'added',
      risk_summary: 'LLM_RISK',
      opportunity_summary: 'LLM_OPP',
      dispute_summary: 'LLM_DIS',
      sides: ['side_a'],
      coverage_gaps: ['gap1'],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: llmJson } }],
          }),
      })) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PIH_SIGNAL_EXTRACTOR;
    delete process.env.PIH_LLM_API_KEY;
    delete process.env.PIH_LLM_MODEL;
  });

  it('replaces placeholder summaries with LLM JSON when configured', async () => {
    await clusterNormalizedItemsForRound(db, roundId, t);
    await extractSignalsForRound(db, roundId, 'en', { forceMockOverlay: false });
    const row = db.prepare(`SELECT signals_json FROM decision_signals LIMIT 1`).get() as { signals_json: string };
    const j = JSON.parse(row.signals_json) as { change?: { change_summary?: string }; risk?: { risk_summary?: string } };
    expect(j.change?.change_summary).toBe('LLM_CHANGE');
    expect(j.risk?.risk_summary).toBe('LLM_RISK');
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
