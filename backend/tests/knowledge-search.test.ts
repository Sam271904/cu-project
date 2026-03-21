import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDb } from '../src/db/db';
import { createServer } from '../src/server';

function requestJson<T = unknown>(opts: {
  hostname: string;
  port: number;
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<{ status: number; body: T | null }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    let bodyBuffer: Buffer | undefined;
    if (opts.body !== undefined) {
      bodyBuffer = Buffer.from(JSON.stringify(opts.body), 'utf-8');
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json; charset=utf-8';
      headers['Content-Length'] = String(bodyBuffer.length);
    }

    const req = http.request(
      {
        hostname: opts.hostname,
        port: opts.port,
        path: opts.path,
        method: opts.method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf-8');
          let parsed: T | null = null;
          if (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('[')) {
            try {
              parsed = JSON.parse(bodyText) as T;
            } catch {
              parsed = null;
            }
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );

    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

const FIXED_NOW = '2026-06-01T12:00:00.000Z';

type SearchHit = {
  cluster_id: string;
  content_summary: string;
  snippet_text: string;
  cluster_kind?: string;
  level?: string;
  tags?: string[];
  personalization_score?: number;
};

function insertClusterAndKnowledge(
  db: ReturnType<typeof openDb>,
  clusterId: string,
  content_summary: string,
  snippet_text: string,
  tags: string[],
  entryJson = '{}',
) {
  db.prepare(
    `
    INSERT INTO clusters (cluster_id, representative_cluster_id, created_at_utc, canonical_signature, clustering_model_version)
    VALUES (?, ?, ?, ?, ?)
    `,
  ).run(clusterId, clusterId, FIXED_NOW, `sig_${clusterId}`, 'v1-test');

  db.prepare(
    `
    INSERT INTO knowledge_entries (cluster_id, content_summary, snippet_text, tags_json, entry_json)
    VALUES (?, ?, ?, ?, ?)
    `,
  ).run(clusterId, content_summary, snippet_text, JSON.stringify(tags), entryJson);
}

describe('knowledge search recall & ranking (Task 7.1 Step 3)', () => {
  let server: ReturnType<typeof createServer>;
  let port = 0;
  let dbPath = '';
  let db: ReturnType<typeof openDb>;

  beforeAll(async () => {
    dbPath = path.join(os.tmpdir(), `e-cu-ksearch-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env.DATABASE_URL = `sqlite:${dbPath}`;
    process.env.PIH_PUSH_ENABLED = 'false';
    db = openDb({ databaseUrl: process.env.DATABASE_URL });

    server = createServer({ db });
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });

  it('empty q returns empty results', async () => {
    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/knowledge/search?q=',
      method: 'GET',
    });
    expect(res.status).toBe(200);
    expect(res.body?.results).toEqual([]);
  });

  it('recall: matches content_summary', async () => {
    insertClusterAndKnowledge(db, 'recall_sum', 'UNIQUE_TOKEN_SUMMARY_XYZ', 'snippet', ['topic:a']);
    insertClusterAndKnowledge(db, 'recall_other', 'other topic', 'no match here', ['topic:b']);

    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent('UNIQUE_TOKEN_SUMMARY_XYZ')}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    const ids = (res.body?.results ?? []).map((r) => r.cluster_id);
    expect(ids).toContain('recall_sum');
    expect(ids).not.toContain('recall_other');
  });

  it('recall: matches snippet_text', async () => {
    insertClusterAndKnowledge(db, 'recall_snip', 'title only', 'BODY_HAS_UNIQUE_SNIP_4421', ['topic:c']);

    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent('UNIQUE_SNIP_4421')}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    expect((res.body?.results ?? []).some((r) => r.cluster_id === 'recall_snip')).toBe(true);
  });

  it('recall: matches tags_json substring', async () => {
    insertClusterAndKnowledge(db, 'recall_tag', 'no token in summary', 'short', ['alpha', 'beta-tag-special-771']);

    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent('beta-tag-special-771')}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    expect((res.body?.results ?? []).map((r) => r.cluster_id)).toContain('recall_tag');
  });

  it('search: tags= filter keeps only entries matching a tag (OR)', async () => {
    insertClusterAndKnowledge(db, 'tagf_a', 'TAGFILTER_Q common line', 's', ['topic:keep', 'misc']);
    insertClusterAndKnowledge(db, 'tagf_b', 'TAGFILTER_Q common line', 's', ['topic:other']);

    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent('TAGFILTER_Q')}&tags=${encodeURIComponent('topic:keep')}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    const ids = (res.body?.results ?? []).map((r) => r.cluster_id);
    expect(ids).toContain('tagf_a');
    expect(ids).not.toContain('tagf_b');
  });

  it('recall: no hit returns empty', async () => {
    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent('ZZZ_NO_SUCH_TOKEN_EVER_999')}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    expect(res.body?.results ?? []).toEqual([]);
  });

  it('ranking: equal personalization sorts by cluster_id ascending (stable contract)', async () => {
    insertClusterAndKnowledge(db, 'rank_z', 'RANK_TIE_TOKEN', 's', ['t']);
    insertClusterAndKnowledge(db, 'rank_m', 'RANK_TIE_TOKEN', 's', ['t']);
    insertClusterAndKnowledge(db, 'rank_a', 'RANK_TIE_TOKEN', 's', ['t']);

    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent('RANK_TIE_TOKEN')}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    const tied = (res.body?.results ?? []).filter((r) => r.content_summary === 'RANK_TIE_TOKEN');
    const ids = tied.map((r) => r.cluster_id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    expect(ids[0]).toBe('rank_a');
    expect(ids[1]).toBe('rank_m');
    expect(ids[2]).toBe('rank_z');
  });

  it('ranking: higher personalization allow-keyword boosts order', async () => {
    db.prepare('DELETE FROM personalization_keyword_rules').run();
    db.prepare('DELETE FROM personalization_personas').run();
    db.prepare('DELETE FROM personalization_feedback').run();

    insertClusterAndKnowledge(db, 'boost_low', 'BOOST_QUERY shared text', 'more', ['t']);
    insertClusterAndKnowledge(db, 'boost_high', 'BOOST_QUERY shared text onlyhere PREFERBOOST', 'more', ['t']);

    await requestJson({
      hostname: '127.0.0.1',
      port,
      path: '/api/personalization',
      method: 'PUT',
      body: {
        keywords: [{ mode: 'allow', keyword: 'preferboost' }],
        personas: [],
      },
    });

    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent('BOOST_QUERY')}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    const results = res.body?.results ?? [];
    const idxHigh = results.findIndex((r) => r.cluster_id === 'boost_high');
    const idxLow = results.findIndex((r) => r.cluster_id === 'boost_low');
    expect(idxHigh).toBeGreaterThanOrEqual(0);
    expect(idxLow).toBeGreaterThanOrEqual(0);
    expect(idxHigh).toBeLessThan(idxLow);
    expect(results[idxHigh]?.personalization_score ?? 0).toBeGreaterThan(results[idxLow]?.personalization_score ?? 0);
  });

  it('deny keyword removes hit from search results', async () => {
    db.prepare('DELETE FROM personalization_keyword_rules').run();
    db.prepare('DELETE FROM personalization_personas').run();

    insertClusterAndKnowledge(db, 'deny_keep', 'DENY_TEST visible line', 'x', ['t']);
    insertClusterAndKnowledge(db, 'deny_drop', 'DENY_TEST secret BADWORD_DROP', 'x', ['t']);

    await requestJson({
      hostname: '127.0.0.1',
      port,
      path: '/api/personalization',
      method: 'PUT',
      body: {
        keywords: [{ mode: 'deny', keyword: 'badword_drop' }],
        personas: [],
      },
    });

    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent('DENY_TEST')}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    const ids = (res.body?.results ?? []).map((r) => r.cluster_id);
    expect(ids).toContain('deny_keep');
    expect(ids).not.toContain('deny_drop');
  });

  it('SQL LIMIT 20: oldest knowledge row by id is excluded when 21+ rows match', async () => {
    const token = `LIMIT20_TOKEN_${Date.now()}`;
    for (let i = 1; i <= 21; i += 1) {
      insertClusterAndKnowledge(db, `lim_${token}_${i}`, `${token} row ${i}`, 'snip', ['lim']);
    }

    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent(token)}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    expect((res.body?.results ?? []).length).toBe(20);
    const ids = new Set((res.body?.results ?? []).map((r) => r.cluster_id));
    expect(ids.has(`lim_${token}_1`)).toBe(false);
    expect(ids.has(`lim_${token}_21`)).toBe(true);
  });

  it('cluster_kind from latest timeline maps to level HIGH vs MEDIUM', async () => {
    const round = db
      .prepare(`INSERT INTO collection_rounds (status, pipeline_version) VALUES (?, ?)`)
      .run('completed', 'v1');
    const roundId = Number(round.lastInsertRowid);

    insertClusterAndKnowledge(db, 'kind_high', 'KIND_LEVEL_TOKEN high', 's', ['t']);
    insertClusterAndKnowledge(db, 'kind_med', 'KIND_LEVEL_TOKEN med', 's', ['t']);

    db.prepare(
      `
      INSERT INTO cluster_timeline_state (collection_round_id, cluster_id, evidence_set_hash, cluster_kind)
      VALUES (?, ?, ?, ?)
      `,
    ).run(roundId, 'kind_high', 'eh1', 'event_update');

    db.prepare(
      `
      INSERT INTO cluster_timeline_state (collection_round_id, cluster_id, evidence_set_hash, cluster_kind)
      VALUES (?, ?, ?, ?)
      `,
    ).run(roundId, 'kind_med', 'eh2', 'topic_drift');

    const res = await requestJson<{ results: SearchHit[] }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/search?q=${encodeURIComponent('KIND_LEVEL_TOKEN')}`,
      method: 'GET',
    });
    expect(res.status).toBe(200);
    const byId = Object.fromEntries((res.body?.results ?? []).map((r) => [r.cluster_id, r]));
    expect(byId.kind_high?.level).toBe('HIGH');
    expect(byId.kind_high?.cluster_kind).toBe('event_update');
    expect(byId.kind_med?.level).toBe('MEDIUM');
    expect(byId.kind_med?.cluster_kind).toBe('topic_drift');
  });
});
