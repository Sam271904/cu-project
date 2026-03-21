import crypto from 'node:crypto';
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
}): Promise<{ status: number; bodyText: string; body: T | null }> {
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
          resolve({ status: res.statusCode ?? 0, bodyText, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

describe('backend api', () => {
  let server: ReturnType<typeof createServer>;
  let port = 0;
  let dbPath = '';
  let db: ReturnType<typeof openDb>;

  beforeAll(async () => {
    dbPath = path.join(os.tmpdir(), `e-cu-backend-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    process.env.DATABASE_URL = `sqlite:${dbPath}`;
    process.env.PIH_PUSH_ENABLED = 'true';
    db = openDb({ databaseUrl: process.env.DATABASE_URL });

    server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port as number;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });

  it('POST /api/collect should create collection_round and return round_id', async () => {
    const res = await requestJson<{
      success: boolean;
      round_id: number;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/collect',
      method: 'POST',
      body: {},
    });

    expect(res.status).toBe(200);
    expect(res.body).not.toBeNull();
    expect(res.body?.success).toBe(true);
    expect(typeof res.body?.round_id).toBe('number');

    const row = db
      .prepare('SELECT COUNT(*) AS cnt FROM collection_rounds')
      .get() as { cnt: number };
    expect(row.cnt).toBe(1);
  });

  it('POST /api/collect useStoredFeeds with no configured feeds returns 400', async () => {
    db.prepare('DELETE FROM rss_feed_configs').run();
    const res = await requestJson<{ success: boolean; error?: string }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/collect',
      method: 'POST',
      body: { useStoredFeeds: true },
    });
    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('no_feeds_configured');
  });

  it('GET/POST/DELETE /api/feeds and duplicate feed_url returns 409', async () => {
    db.prepare('DELETE FROM rss_feed_configs').run();

    const g1 = await requestJson<{ success: boolean; feeds: unknown[] }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/feeds',
      method: 'GET',
    });
    expect(g1.status).toBe(200);
    expect(g1.body?.feeds?.length).toBe(0);

    const a1 = await requestJson<{ success: boolean; id: number }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/feeds',
      method: 'POST',
      body: { source_type: 'social', feed_url: 'https://example.com/f1.xml', source_name: 'N1' },
    });
    expect(a1.status).toBe(200);
    expect(a1.body?.id).toBeGreaterThan(0);

    const dup = await requestJson({
      hostname: '127.0.0.1',
      port,
      path: '/api/feeds',
      method: 'POST',
      body: { source_type: 'tech', feed_url: 'https://example.com/f1.xml' },
    });
    expect(dup.status).toBe(409);

    const del = await requestJson<{ success: boolean; deleted: number }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/feeds?id=${a1.body?.id}`,
      method: 'DELETE',
    });
    expect(del.status).toBe(200);
    expect(del.body?.deleted).toBe(1);
  });

  it('POST /api/import/bookmarks should ingest bookmark raw_items and run pipeline', async () => {
    const res = await requestJson<{
      success: boolean;
      round_id: number;
      inserted: number;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/import/bookmarks',
      method: 'POST',
      body: {
        lang: 'en',
        items: [
          { url: 'https://example.com/bookmark-a', title: 'A', folder: 'Read', note: 'Note one' },
          { url: 'https://example.com/bookmark-b', title: 'B' },
          { url: 'not-a-url' },
          { url: 'https://example.com/bookmark-a', title: 'dup same url' },
        ],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.inserted).toBe(2);

    const rid = res.body?.round_id as number;
    const rawCnt = db
      .prepare('SELECT COUNT(*) as c FROM raw_items WHERE collection_round_id = ? AND source_type = ?')
      .get(rid, 'bookmark') as { c: number };
    expect(rawCnt.c).toBe(2);

    const normCnt = db
      .prepare(
        `
        SELECT COUNT(*) as c FROM normalized_items n
        JOIN raw_items r ON r.id = n.raw_item_id
        WHERE r.collection_round_id = ? AND r.source_type = 'bookmark'
        `,
      )
      .get(rid) as { c: number };
    expect(normCnt.c).toBe(2);
  });

  it('GET/PUT /api/personalization and POST feedback', async () => {
    const g0 = await requestJson<{ success: boolean; keywords: unknown[] }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/personalization',
      method: 'GET',
    });
    expect(g0.status).toBe(200);
    expect(g0.body?.success).toBe(true);
    expect(Array.isArray(g0.body?.keywords)).toBe(true);

    const put = await requestJson({
      hostname: '127.0.0.1',
      port,
      path: '/api/personalization',
      method: 'PUT',
      body: {
        keywords: [
          { mode: 'allow', keyword: 'Seed' },
          { mode: 'deny', keyword: 'zzdenyzz' },
        ],
        personas: [{ name: 'p1', keywords: ['Social'], weight: 1.5 }],
      },
    });
    expect(put.status).toBe(200);
    expect((put.body as any)?.success).toBe(true);

    const g1 = await requestJson<{ keywords: Array<{ keyword: string }> }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/personalization',
      method: 'GET',
    });
    expect(g1.body?.keywords?.length).toBeGreaterThanOrEqual(2);

    const seedRes = await requestJson<{ success: boolean; round_id: number }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/seed/test-data',
      method: 'POST',
      body: { scenario: 'single_round', lang: 'en' },
    });
    expect(seedRes.status).toBe(200);
    const clusterRow = db
      .prepare('SELECT cluster_id FROM knowledge_entries LIMIT 1')
      .get() as { cluster_id: string };

    const fb = await requestJson({
      hostname: '127.0.0.1',
      port,
      path: '/api/personalization/feedback',
      method: 'POST',
      body: { cluster_id: clusterRow.cluster_id, sentiment: 1, saved: true },
    });
    expect(fb.status).toBe(200);
    expect((fb.body as any)?.success).toBe(true);
  });

  it('POST /api/import/bookmarks with empty items returns 400', async () => {
    const res = await requestJson({
      hostname: '127.0.0.1',
      port,
      path: '/api/import/bookmarks',
      method: 'POST',
      body: { items: [] },
    });
    expect(res.status).toBe(400);
    expect((res.body as any)?.error).toBe('empty_items');
  });

  it('POST /api/collect useStoredFeeds reads URLs from rss_feed_configs', async () => {
    db.prepare('DELETE FROM rss_feed_configs').run();

    const rssXmlSocial = `
<rss version="2.0"><channel><title>S</title>
<item><title>SA</title><link>https://example.com/s/a</link><guid>g1</guid><description>Social stored</description></item>
</channel></rss>`.trim();
    const rssXmlTech = `
<rss version="2.0"><channel><title>T</title>
<item><title>TA</title><link>https://example.com/t/a</link><guid>g2</guid><description>Tech stored</description></item>
</channel></rss>`.trim();

    const rssServer = http.createServer((req, res) => {
      const path = (req.url ?? '').split('?')[0] ?? '';
      const xml = path.endsWith('/social') ? rssXmlSocial : rssXmlTech;
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(xml);
    });

    let rssPort = 0;
    await new Promise<void>((resolve) => {
      rssServer.listen(0, '127.0.0.1', () => {
        rssPort = (rssServer.address() as any).port as number;
        resolve();
      });
    });

    try {
      const base = `http://127.0.0.1:${rssPort}`;
      const addS = await requestJson({
        hostname: '127.0.0.1',
        port,
        path: '/api/feeds',
        method: 'POST',
        body: { source_type: 'social', feed_url: `${base}/social` },
      });
      expect(addS.status).toBe(200);
      const addT = await requestJson({
        hostname: '127.0.0.1',
        port,
        path: '/api/feeds',
        method: 'POST',
        body: { source_type: 'tech', feed_url: `${base}/tech` },
      });
      expect(addT.status).toBe(200);

      const collectRes = await requestJson<{
        success: boolean;
        ingested: { social: number; tech: number };
      }>({
        hostname: '127.0.0.1',
        port,
        path: '/api/collect',
        method: 'POST',
        body: { useStoredFeeds: true, lang: 'en' },
      });
      expect(collectRes.status).toBe(200);
      expect(collectRes.body?.success).toBe(true);
      expect(collectRes.body?.ingested.social).toBe(1);
      expect(collectRes.body?.ingested.tech).toBe(1);
    } finally {
      await new Promise<void>((resolve) => rssServer.close(() => resolve()));
    }
  });

  it('POST /api/seed/test-data should create clusters + knowledge entries', async () => {
    const before = db.prepare('SELECT MAX(id) as maxId FROM collection_rounds').get() as { maxId: number | null };
    const beforeMax = before.maxId ?? 0;

    const seedRes = await requestJson<{
      success: boolean;
      round_id: number;
      normalized_items: number;
      clusters: number;
      knowledge_entries: number;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/seed/test-data',
      method: 'POST',
      body: { scenario: 'single_round' },
    });

    expect(seedRes.status).toBe(200);
    expect(seedRes.body?.success).toBe(true);
    expect(typeof seedRes.body?.round_id).toBe('number');
    expect(seedRes.body?.round_id).toBeGreaterThan(beforeMax);
    expect(seedRes.body?.clusters).toBeGreaterThan(0);
    expect(seedRes.body?.knowledge_entries).toBeGreaterThan(0);

    const latest = db
      .prepare('SELECT MAX(id) as maxId FROM collection_rounds')
      .get() as { maxId: number };
    expect(latest.maxId).toBe(seedRes.body?.round_id);

    const roundId = seedRes.body?.round_id as number;
    const knowledgeCnt = db
      .prepare(
        `
        SELECT COUNT(*) as cnt
        FROM knowledge_entries ke
        WHERE ke.cluster_id IN (
          SELECT ce.cluster_id
          FROM cluster_evidence ce
          JOIN normalized_items n ON n.id = ce.normalized_item_id
          WHERE n.collection_round_id = ?
        )
        `,
      )
      .get(roundId) as { cnt: number };
    expect(knowledgeCnt.cnt).toBeGreaterThan(0);

    const searchRes = await requestJson<{
      results: Array<{
        cluster_id: string;
        content_summary: string;
        snippet_text: string;
        cluster_kind: string;
        level: string;
        tags: string[];
      }>;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/knowledge/search?q=Seed',
      method: 'GET',
    });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body?.results.length).toBeGreaterThan(0);
    const firstSearch = searchRes.body?.results[0];
    expect(['event_update', 'topic_drift']).toContain(String(firstSearch?.cluster_kind));
    expect(['HIGH', 'MEDIUM']).toContain(String(firstSearch?.level));

    const firstClusterId = searchRes.body?.results?.[0]?.cluster_id;
    expect(typeof firstClusterId).toBe('string');

    const detailRes = await requestJson<{
      success: boolean;
      cluster_id: string;
      content_summary: string;
      snippet_text: string;
      tags: string[];
      timeline: Array<{
        id: string;
        role: string;
        link_confidence: number;
        url: string;
        published_at: string;
        snippet_text: string;
      }>;
    }>({
      hostname: '127.0.0.1',
      port,
      path: `/api/knowledge/cluster?cluster_id=${encodeURIComponent(String(firstClusterId))}`,
      method: 'GET',
    });

    expect(detailRes.status).toBe(200);
    expect(detailRes.body?.success).toBe(true);
    expect(detailRes.body?.cluster_id).toBe(firstClusterId);
    expect(typeof detailRes.body?.content_summary).toBe('string');
    expect(Array.isArray(detailRes.body?.timeline)).toBe(true);
    expect((detailRes.body?.timeline ?? []).length).toBeGreaterThan(0);
  });

  it('POST /api/seed/test-data with two_rounds should return cluster_kind summary including event_update', async () => {
    const seedRes = await requestJson<{
      success: boolean;
      scenario: string;
      round_1_id: number;
      round_2_id: number | null;
      round_id: number;
      cluster_kind_summary: Record<string, number>;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/seed/test-data',
      method: 'POST',
      body: { scenario: 'two_rounds' },
    });

    expect(seedRes.status).toBe(200);
    expect(seedRes.body?.success).toBe(true);
    expect(seedRes.body?.scenario).toBe('two_rounds');
    expect(typeof seedRes.body?.round_1_id).toBe('number');
    expect(typeof seedRes.body?.round_2_id).toBe('number');
    expect(seedRes.body?.round_2_id).toBe(seedRes.body?.round_id);

    const summary = seedRes.body?.cluster_kind_summary ?? {};
    expect((summary.event_update ?? 0) + (summary.topic_drift ?? 0)).toBeGreaterThan(0);
    expect(summary.event_update ?? 0).toBeGreaterThan(0);

    const kindsInDb = db
      .prepare(
        'SELECT cluster_kind, COUNT(*) as cnt FROM cluster_timeline_state WHERE collection_round_id = ? GROUP BY cluster_kind',
      )
      .all(seedRes.body?.round_id) as Array<{ cluster_kind: string; cnt: number }>;
    expect(kindsInDb.length).toBeGreaterThan(0);

    const demoStatus = await requestJson<{
      success: boolean;
      latest_round_id: number | null;
      normalized_items: number;
      clusters: number;
      decision_signals: number;
      knowledge_entries: number;
      cluster_kind_summary: Record<string, number>;
      notification_counts?: {
        queued: number;
        sent: number;
        failed: number;
        skipped: number;
      };
      privacy_checks?: {
        pass: boolean;
        details: {
          has_forbidden_knowledge_columns: boolean;
          has_forbidden_json_keys: boolean;
          max_signal_snippet_length: number;
          max_knowledge_snippet_length: number;
        };
      };
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/demo/status',
      method: 'GET',
    });
    expect(demoStatus.status).toBe(200);
    expect(demoStatus.body?.success).toBe(true);
    expect(demoStatus.body?.latest_round_id).toBe(seedRes.body?.round_id);
    expect((demoStatus.body?.normalized_items ?? 0)).toBeGreaterThan(0);
    expect((demoStatus.body?.clusters ?? 0)).toBeGreaterThan(0);
    expect((demoStatus.body?.decision_signals ?? 0)).toBeGreaterThan(0);
    expect((demoStatus.body?.knowledge_entries ?? 0)).toBeGreaterThan(0);
    expect(typeof demoStatus.body?.notification_counts?.queued).toBe('number');
    expect(typeof demoStatus.body?.notification_counts?.sent).toBe('number');
    expect(typeof demoStatus.body?.notification_counts?.failed).toBe('number');
    expect(typeof demoStatus.body?.notification_counts?.skipped).toBe('number');
    expect(demoStatus.body?.privacy_checks?.pass).toBe(true);
    expect(demoStatus.body?.privacy_checks?.details.has_forbidden_knowledge_columns).toBe(false);
    expect(demoStatus.body?.privacy_checks?.details.has_forbidden_json_keys).toBe(false);
    expect((demoStatus.body?.privacy_checks?.details.max_signal_snippet_length ?? 0)).toBeLessThanOrEqual(600);
    expect((demoStatus.body?.privacy_checks?.details.max_knowledge_snippet_length ?? 0)).toBeLessThanOrEqual(600);
    expect(demoStatus.body?.notification_policy?.weights?.w1).toBeDefined();
    expect(demoStatus.body?.notification_policy?.high_threshold).toBeDefined();
  });

  it('POST /api/collect should ingest 1 social RSS + 1 tech RSS with first-wins dedup', async () => {
    const rssXmlSocialRound1 = `
<rss version="2.0">
  <channel>
    <title>Social RSS</title>
    <item>
      <title>Social Item A</title>
      <link>https://example.com/social/a</link>
      <guid>dup-guid</guid>
      <description>Social FIRST description</description>
      <author>Social First author</author>
    </item>
    <item>
      <title>Social Item B</title>
      <link>https://example.com/social/b</link>
      <guid>dup-guid</guid>
      <description>Social SECOND description</description>
      <author>Social Second author</author>
    </item>
  </channel>
</rss>
`.trim();

    const rssXmlSocialRound2 = `
<rss version="2.0">
  <channel>
    <title>Social RSS</title>
    <item>
      <title>Social Item A</title>
      <link>https://example.com/social/a</link>
      <guid>dup-guid</guid>
      <description>Social FIRST description</description>
      <author>Social First author</author>
    </item>
    <item>
      <title>Social Item C</title>
      <link>https://example.com/social/c</link>
      <guid>dup-guid-2</guid>
      <description>Social SECOND description</description>
      <author>Social Second author</author>
    </item>
  </channel>
</rss>
`.trim();

    const rssXmlTechRound1 = `
<rss version="2.0">
  <channel>
    <title>Tech RSS</title>
    <item>
      <title>Tech Item A</title>
      <link>https://example.com/tech/a</link>
      <guid>dup-guid</guid>
      <description>Tech FIRST description</description>
      <author>Tech First author</author>
    </item>
    <item>
      <title>Tech Item B</title>
      <link>https://example.com/tech/b</link>
      <guid>dup-guid</guid>
      <description>Tech SECOND description</description>
      <author>Tech Second author</author>
    </item>
  </channel>
</rss>
`.trim();

    const rssXmlTechRound2 = `
<rss version="2.0">
  <channel>
    <title>Tech RSS</title>
    <item>
      <title>Tech Item A</title>
      <link>https://example.com/tech/a</link>
      <guid>dup-guid</guid>
      <description>Tech FIRST description</description>
      <author>Tech First author</author>
    </item>
    <item>
      <title>Tech Item C</title>
      <link>https://example.com/tech/c</link>
      <guid>dup-guid-2</guid>
      <description>Tech SECOND description</description>
      <author>Tech Second author</author>
    </item>
  </channel>
</rss>
`.trim();

    let rssPort = 0;
    let roundIdx = 0;
    const rssServer = http.createServer((req, res) => {
      const url = (req.url ?? '').split('?')[0] ?? '';
      let xml = '';
      if (url === '/social') {
        roundIdx += 1;
        xml = roundIdx === 1 ? rssXmlSocialRound1 : rssXmlSocialRound2;
      } else {
        // /tech is requested right after /social during each /api/collect round
        xml = roundIdx === 1 ? rssXmlTechRound1 : rssXmlTechRound2;
      }
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(xml);
    });

    await new Promise<void>((resolve) => {
      rssServer.listen(0, '127.0.0.1', () => {
        rssPort = (rssServer.address() as any).port as number;
        resolve();
      });
    });

    try {
      const doCollect = async () => {
        return requestJson<{
          success: boolean;
          round_id: number;
          ingested: { social: number; tech: number };
        }>({
          hostname: '127.0.0.1',
          port,
          path: '/api/collect',
          method: 'POST',
          body: {
            socialRssFeeds: [{ feedUrl: `http://127.0.0.1:${rssPort}/social` }],
            techRssFeeds: [{ feedUrl: `http://127.0.0.1:${rssPort}/tech` }],
          },
        });
      };

      const collect1 = await doCollect();
      expect(collect1.status).toBe(200);
      expect(collect1.body?.success).toBe(true);
      expect(collect1.body?.ingested.social).toBe(1);
      expect(collect1.body?.ingested.tech).toBe(1);

      let totalNotif = db
        .prepare(
          'SELECT COUNT(*) as cnt FROM notification_event_log WHERE user_id = ? AND status = ?'
        )
        .get('local-user', 'queued') as { cnt: number };
      expect(totalNotif.cnt).toBe(0);

      const collect2 = await doCollect();
      expect(collect2.status).toBe(200);
      expect(collect2.body?.success).toBe(true);
      expect(collect2.body?.ingested.social).toBe(2);
      expect(collect2.body?.ingested.tech).toBe(2);

      totalNotif = db
        .prepare(
          'SELECT COUNT(*) as cnt FROM notification_event_log WHERE user_id = ? AND status = ?'
        )
        .get('local-user', 'queued') as { cnt: number };
      expect(totalNotif.cnt).toBe(2);

      const notifRows = db
        .prepare(
          'SELECT reminder_level, payload_json FROM notification_event_log WHERE user_id = ? AND status = ?'
        )
        .all('local-user', 'queued') as Array<{ reminder_level: string; payload_json: string }>;
      expect(notifRows.length).toBe(2);
      for (const r of notifRows) {
        expect(['high', 'medium']).toContain(r.reminder_level);
        const payload = JSON.parse(r.payload_json) as Record<string, unknown>;
        const keys = Object.keys(payload).sort();
        expect(keys).toEqual(['event_key', 'reminder_level', 'short_summary', 'title'].sort());
      }

      const collect3 = await doCollect();
      expect(collect3.status).toBe(200);

      totalNotif = db
        .prepare(
          'SELECT COUNT(*) as cnt FROM notification_event_log WHERE user_id = ? AND status = ?'
        )
        .get('local-user', 'queued') as { cnt: number };
      // dedup/cooldown: no extra reminders in round3 with unchanged evidence set.
      expect(totalNotif.cnt).toBe(2);

      // decision_signals should exist for the two clusters.
      const latestRoundId = collect3.body?.round_id as number;
      const signalTotalForRound = db
        .prepare(
          `
          SELECT COUNT(DISTINCT ds.cluster_id) as cnt
          FROM decision_signals ds
          JOIN cluster_evidence ce ON ce.cluster_id = ds.cluster_id
          JOIN normalized_items n ON n.id = ce.normalized_item_id
          WHERE n.collection_round_id = ?
          `,
        )
        .get(latestRoundId) as { cnt: number };
      expect(signalTotalForRound.cnt).toBe(2);

      // knowledge search should hit
      const searchRes = await requestJson<{
        results: Array<{
          cluster_id: string;
          content_summary: string;
          snippet_text: string;
          cluster_kind: string;
          level: string;
          tags: string[];
        }>;
      }>({
        hostname: '127.0.0.1',
        port,
        path: '/api/knowledge/search?q=Social',
        method: 'GET',
      });

      expect(searchRes.status).toBe(200);
      expect(searchRes.body).not.toBeNull();
      expect(searchRes.body?.results.length).toBeGreaterThanOrEqual(1);
      const hit = searchRes.body?.results.find((r) => r.cluster_id && r.content_summary.includes('Social'));
      expect(hit).toBeTruthy();
    } finally {
      await new Promise<void>((resolve) => rssServer.close(() => resolve()));
    }
  });

  it('GET /api/homepage should return stable empty schema', async () => {
    const normalizedCnt = db
      .prepare('SELECT COUNT(*) as cnt FROM normalized_items')
      .get() as { cnt: number };
    const latestRound = db.prepare('SELECT MAX(id) as maxId FROM collection_rounds').get() as { maxId: number };
    const signalsCntForLatestRound = db
      .prepare(
        `
        SELECT COUNT(DISTINCT ds.cluster_id) as cnt
        FROM decision_signals ds
        JOIN cluster_evidence ce ON ce.cluster_id = ds.cluster_id
        JOIN normalized_items n ON n.id = ce.normalized_item_id
        WHERE n.collection_round_id = ?
        `,
      )
      .get(latestRound.maxId) as { cnt: number };

    const res = await requestJson<{
      decision_cards: unknown[];
      topic_board: unknown[];
      timeline_feed: unknown[];
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/homepage',
      method: 'GET',
    });

    expect(res.status).toBe(200);
    expect(res.body).not.toBeNull();
    expect(Array.isArray(res.body?.decision_cards)).toBe(true);
    expect(Array.isArray(res.body?.topic_board)).toBe(true);
    expect(Array.isArray(res.body?.timeline_feed)).toBe(true);

    if (signalsCntForLatestRound.cnt === 0) {
      expect(res.body?.decision_cards).toEqual([]);
      expect(res.body?.topic_board).toEqual([]);
      expect(res.body?.timeline_feed).toEqual([]);
      return;
    }

    // When normalized_items exist, homepage should surface them as cards.
    expect((res.body?.decision_cards ?? []).length).toBe(signalsCntForLatestRound.cnt);
    expect((res.body?.timeline_feed ?? []).length).toBe(signalsCntForLatestRound.cnt);
    expect(res.body?.topic_board.length).toBeGreaterThan(0);

    const cards = res.body?.decision_cards as Array<any>;
    const social = cards.find((c) => c.source_type === 'social');
    const tech = cards.find((c) => c.source_type === 'tech');

    expect(String(social?.change_summary ?? '')).toContain('Social FIRST description');
    expect(String(tech?.change_summary ?? '')).toContain('Tech FIRST description');
    expect(String(social?.change_summary ?? '')).toMatch(/^Evidence updated\s*\(/);
    expect(String(tech?.change_summary ?? '')).toMatch(/^Evidence updated\s*\(/);
  });

  it('POST /api/push/subscribe then /api/push/unsubscribe should persist and delete subscription', async () => {
    const endpoint = 'https://example.com/push/abc';

    const subRes = await requestJson<{
      success: boolean;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/subscribe',
      method: 'POST',
      body: {
        endpoint,
        keys: { p256dh: 'p', auth: 'a' },
      },
    });

    expect(subRes.status).toBe(200);
    expect(subRes.body).not.toBeNull();
    expect(subRes.body?.success).toBe(true);

    const row1 = db
      .prepare('SELECT COUNT(*) AS cnt FROM notification_subscriptions')
      .get() as { cnt: number };
    expect(row1.cnt).toBe(1);

    const unsubRes = await requestJson<{
      success: boolean;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/unsubscribe',
      method: 'POST',
      body: { endpoint },
    });

    expect(unsubRes.status).toBe(200);
    expect(unsubRes.body).not.toBeNull();
    expect(unsubRes.body?.success).toBe(true);
    expect((unsubRes.body as { unsubscribe_logged?: boolean }).unsubscribe_logged).toBe(true);

    const row2 = db
      .prepare('SELECT COUNT(*) AS cnt FROM notification_subscriptions')
      .get() as { cnt: number };
    expect(row2.cnt).toBe(0);

    const expectedSha = crypto.createHash('sha256').update(endpoint).digest('hex');
    const logRow = db
      .prepare(
        'SELECT endpoint_sha256, deleted_rows FROM push_unsubscribe_log ORDER BY id DESC LIMIT 1',
      )
      .get() as { endpoint_sha256: string; deleted_rows: number };
    expect(logRow.endpoint_sha256).toBe(expectedSha);
    expect(logRow.deleted_rows).toBe(1);
  });

  it('GET /api/push/status should return subscription count and vapid flag', async () => {
    const before = db.prepare('SELECT COUNT(*) AS cnt FROM notification_subscriptions').get() as { cnt: number };

    const st = await requestJson<{
      success: boolean;
      subscription_count: number;
      vapid_configured: boolean;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/status',
      method: 'GET',
    });

    expect(st.status).toBe(200);
    expect(st.body?.success).toBe(true);
    expect(st.body?.subscription_count).toBe(before.cnt);
    expect(typeof st.body?.vapid_configured).toBe('boolean');
  });

  it('POST /api/push/subscribe should persist push_permission_status and consent_timestamp', async () => {
    const endpoint = 'https://example.com/push/consent-row';
    const consentTs = '2026-03-21T00:00:00.000Z';

    const subRes = await requestJson<{ success: boolean }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/subscribe',
      method: 'POST',
      body: {
        endpoint,
        keys: { p256dh: 'x', auth: 'y' },
        push_permission_status: 'denied',
        consent_timestamp: consentTs,
      },
    });

    expect(subRes.status).toBe(200);
    expect(subRes.body?.success).toBe(true);

    const row = db
      .prepare(
        'SELECT push_permission_status, consent_timestamp FROM notification_subscriptions WHERE endpoint = ?',
      )
      .get(endpoint) as { push_permission_status: string; consent_timestamp: string | null };

    expect(row.push_permission_status).toBe('denied');
    expect(row.consent_timestamp).toBe(consentTs);

    const cleanup = await requestJson<{ success: boolean }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/unsubscribe',
      method: 'POST',
      body: { endpoint },
    });
    expect(cleanup.status).toBe(200);
    expect(cleanup.body?.success).toBe(true);
  });

  it('POST /api/push/send (simulate) should mark queued as sent or skipped', async () => {
    const endpoint = 'https://example.com/push/sim';

    // 1) subscribe so we can "send"
    const subRes = await requestJson<{
      success: boolean;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/subscribe',
      method: 'POST',
      body: {
        endpoint,
        keys: { p256dh: 'p', auth: 'a' },
      },
    });
    expect(subRes.status).toBe(200);
    expect(subRes.body?.success).toBe(true);

    // 2) insert 2 queued events for known event_key values
    db.prepare(
      `
      INSERT INTO notification_event_log
        (user_id, event_key, reminder_level, signal_fingerprint, payload_json, status)
      VALUES
        (?, ?, ?, ?, ?, 'queued')
      `,
    ).run(
      'local-user',
      'test_event_send_1',
      'high',
      'fp1',
      JSON.stringify({
        event_key: 'test_event_send_1',
        reminder_level: 'high',
        title: 'Key change (high)',
        short_summary: 'Hello',
      }),
    );
    db.prepare(
      `
      INSERT INTO notification_event_log
        (user_id, event_key, reminder_level, signal_fingerprint, payload_json, status)
      VALUES
        (?, ?, ?, ?, ?, 'queued')
      `,
    ).run(
      'local-user',
      'test_event_send_2',
      'medium',
      'fp2',
      JSON.stringify({
        event_key: 'test_event_send_2',
        reminder_level: 'medium',
        title: 'Key change (medium)',
        short_summary: 'Hello',
      }),
    );

    const sendRes = await requestJson<{
      success: boolean;
      mode: string;
      sent: number;
      skipped: number;
      processed: number;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/send',
      method: 'POST',
      body: { mode: 'simulate', limit: 10 },
    });

    expect(sendRes.status).toBe(200);
    expect(sendRes.body?.success).toBe(true);
    expect(sendRes.body?.mode).toBe('simulate');

    const sentStatuses = db
      .prepare(
        `SELECT event_key, status FROM notification_event_log WHERE user_id = ? AND event_key IN (?, ?)`,
      )
      .all('local-user', 'test_event_send_1', 'test_event_send_2') as Array<{ event_key: string; status: string }>;
    const statusMap = new Map(sentStatuses.map((r) => [r.event_key, r.status]));
    expect(statusMap.get('test_event_send_1')).toBe('sent');
    expect(statusMap.get('test_event_send_2')).toBe('sent');

    // 3) unsubscribe, then insert a queued event should be skipped
    const unsubRes = await requestJson<{
      success: boolean;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/unsubscribe',
      method: 'POST',
      body: { endpoint },
    });
    expect(unsubRes.status).toBe(200);
    expect(unsubRes.body?.success).toBe(true);

    db.prepare(
      `
      INSERT INTO notification_event_log
        (user_id, event_key, reminder_level, signal_fingerprint, payload_json, status)
      VALUES
        (?, ?, ?, ?, ?, 'queued')
      `,
    ).run(
      'local-user',
      'test_event_skip_1',
      'high',
      'fp3',
      JSON.stringify({
        event_key: 'test_event_skip_1',
        reminder_level: 'high',
        title: 'Key change (high)',
        short_summary: 'Hello',
      }),
    );

    const sendRes2 = await requestJson<{
      success: boolean;
      mode: string;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/send',
      method: 'POST',
      body: { mode: 'simulate', limit: 10 },
    });

    expect(sendRes2.status).toBe(200);
    expect(sendRes2.body?.success).toBe(true);
    expect(sendRes2.body?.mode).toBe('simulate');

    const skipStatus = db
      .prepare('SELECT status FROM notification_event_log WHERE user_id = ? AND event_key = ?')
      .get('local-user', 'test_event_skip_1') as { status: string };
    expect(skipStatus.status).toBe('skipped_no_subscription');
  });

  it('POST /api/push/send (real) without VAPID env should return 501 and keep queued', async () => {
    const endpoint = 'https://example.com/push/real-missing';

    const prevPublic = process.env.VAPID_PUBLIC_KEY;
    const prevPrivate = process.env.VAPID_PRIVATE_KEY;
    try {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      // Ensure there is at least one subscription: missing VAPID should short-circuit before any queue updates.
      const subRes = await requestJson<{
        success: boolean;
      }>({
        hostname: '127.0.0.1',
        port,
        path: '/api/push/subscribe',
        method: 'POST',
        body: {
          endpoint,
          keys: { p256dh: 'p', auth: 'a' },
        },
      });
      expect(subRes.status).toBe(200);
      expect(subRes.body?.success).toBe(true);

      db.prepare(
        `
        INSERT INTO notification_event_log
          (user_id, event_key, reminder_level, signal_fingerprint, payload_json, status)
        VALUES
          (?, ?, ?, ?, ?, 'queued')
        `,
      ).run(
        'local-user',
        'test_event_real_missing_1',
        'high',
        'fp-real-missing-1',
        JSON.stringify({
          event_key: 'test_event_real_missing_1',
          reminder_level: 'high',
          title: 'Key change (high)',
          short_summary: 'Hello',
        }),
      );

      const sendRes = await requestJson<{
        success: boolean;
        error: string;
      }>({
        hostname: '127.0.0.1',
        port,
        path: '/api/push/send',
        method: 'POST',
        body: { mode: 'real', limit: 10 },
      });

      expect(sendRes.status).toBe(501);
      expect(sendRes.body?.success).toBe(false);

      const st = db
        .prepare('SELECT status FROM notification_event_log WHERE user_id = ? AND event_key = ?')
        .get('local-user', 'test_event_real_missing_1') as { status: string };
      expect(st.status).toBe('queued');
    } finally {
      if (prevPublic !== undefined) process.env.VAPID_PUBLIC_KEY = prevPublic;
      if (prevPrivate !== undefined) process.env.VAPID_PRIVATE_KEY = prevPrivate;
    }
  });

  it('GET /api/push/vapid-public-key should return success shape', async () => {
    const res = await requestJson<{
      success: boolean;
      publicKey?: string | null;
      error?: string;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/vapid-public-key',
      method: 'GET',
    });

    expect(res.status).toBe(200);
    expect(res.body).not.toBeNull();
    if (res.body?.success) {
      expect(typeof res.body.publicKey).toBe('string');
      expect((res.body.publicKey ?? '').length).toBeGreaterThan(10);
    } else {
      expect(res.body?.error).toBeDefined();
    }
  });

  it('POST /api/push/enqueue-test should create queued notification with strict payload', async () => {
    const res = await requestJson<{
      success: boolean;
      event_key: string;
      reminder_level: string;
    }>({
      hostname: '127.0.0.1',
      port,
      path: '/api/push/enqueue-test',
      method: 'POST',
      body: { reminder_level: 'high' },
    });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(typeof res.body?.event_key).toBe('string');

    const row = db
      .prepare('SELECT reminder_level, payload_json, status FROM notification_event_log WHERE user_id = ? AND event_key = ? ORDER BY id DESC LIMIT 1')
      .get('local-user', res.body?.event_key) as { reminder_level: string; payload_json: string; status: string };

    expect(row.status).toBe('queued');
    expect(row.reminder_level).toBe('high');

    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    const keys = Object.keys(payload).sort();
    expect(keys).toEqual(['event_key', 'reminder_level', 'short_summary', 'title'].sort());
    expect(typeof payload.short_summary).toBe('string');
  });

  it('privacy: should enforce snippet limit and avoid disallowed full-text fields in persisted JSON', async () => {
    const veryLong = 'L'.repeat(2400);
    const rssXmlSocial = `
<rss version="2.0">
  <channel>
    <title>Privacy RSS</title>
    <item>
      <title>Privacy Item A</title>
      <link>https://example.com/privacy/a</link>
      <guid>privacy-guid-a</guid>
      <description>${veryLong}</description>
      <author>Privacy Author</author>
    </item>
  </channel>
</rss>
`.trim();

    let rssPort = 0;
    const rssServer = http.createServer((req, res) => {
      const url = (req.url ?? '').split('?')[0] ?? '';
      const xml = url === '/social' ? rssXmlSocial : '<rss version="2.0"><channel></channel></rss>';
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(xml);
    });

    await new Promise<void>((resolve) => {
      rssServer.listen(0, '127.0.0.1', () => {
        rssPort = (rssServer.address() as any).port as number;
        resolve();
      });
    });

    try {
      const collectRes = await requestJson<{
        success: boolean;
        round_id: number;
      }>({
        hostname: '127.0.0.1',
        port,
        path: '/api/collect',
        method: 'POST',
        body: {
          socialRssFeeds: [{ feedUrl: `http://127.0.0.1:${rssPort}/social` }],
          techRssFeeds: [],
        },
      });

      expect(collectRes.status).toBe(200);
      expect(collectRes.body?.success).toBe(true);

      const latestRound = collectRes.body?.round_id as number;
      const dsRows = db
        .prepare(
          `
          SELECT ds.signals_json
          FROM decision_signals ds
          JOIN cluster_evidence ce ON ce.cluster_id = ds.cluster_id
          JOIN normalized_items n ON n.id = ce.normalized_item_id
          WHERE n.collection_round_id = ?
          `,
        )
        .all(latestRound) as Array<{ signals_json: string }>;
      expect(dsRows.length).toBeGreaterThan(0);

      const keRows = db
        .prepare(
          `
          SELECT ke.entry_json, ke.snippet_text
          FROM knowledge_entries ke
          WHERE ke.cluster_id IN (
            SELECT DISTINCT ce.cluster_id
            FROM cluster_evidence ce
            JOIN normalized_items n ON n.id = ce.normalized_item_id
            WHERE n.collection_round_id = ?
          )
          `,
        )
        .all(latestRound) as Array<{ entry_json: string; snippet_text: string }>;
      expect(keRows.length).toBeGreaterThan(0);

      function collectKeysDeep(x: unknown, out: Set<string>) {
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x)) {
          for (const i of x) collectKeysDeep(i, out);
          return;
        }
        const o = x as Record<string, unknown>;
        for (const k of Object.keys(o)) {
          out.add(k);
          collectKeysDeep(o[k], out);
        }
      }

      const banned = ['full_text', 'body_html', 'original_body'];

      for (const row of dsRows) {
        const parsed = JSON.parse(row.signals_json) as any;
        const keys = new Set<string>();
        collectKeysDeep(parsed, keys);
        for (const b of banned) expect(keys.has(b)).toBe(false);

        const links = Array.isArray(parsed?.change?.evidence_links) ? parsed.change.evidence_links : [];
        for (const l of links) {
          const snippet = String(l?.evidence_snippet?.snippet_text ?? '');
          expect(snippet.length).toBeLessThanOrEqual(600);
        }
      }

      for (const row of keRows) {
        expect(row.snippet_text.length).toBeLessThanOrEqual(600);
        const parsed = JSON.parse(row.entry_json) as any;
        const keys = new Set<string>();
        collectKeysDeep(parsed, keys);
        for (const b of banned) expect(keys.has(b)).toBe(false);
      }

      const tableColumns = db
        .prepare(`PRAGMA table_info('knowledge_entries')`)
        .all() as Array<{ name: string }>;
      const names = new Set(tableColumns.map((c) => c.name));
      for (const b of banned) expect(names.has(b)).toBe(false);
    } finally {
      await new Promise<void>((resolve) => rssServer.close(() => resolve()));
    }
  });
});

