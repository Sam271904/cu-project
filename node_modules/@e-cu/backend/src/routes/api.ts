import type http from 'node:http';
import type Database from 'better-sqlite3';

import crypto from 'node:crypto';

import { collectRssFromUrl } from '../adapters/rss/collectFromFeedUrl';
import type { RawItem } from '../adapters/rss/types';
import { normalizeRawItemsForRound } from '../services/normalize/normalizeRawItemsForRound';
import {
  clusterNormalizedItemsForRound,
  resolveEvidenceRootClusterId,
} from '../services/cluster/clusterNormalizedItemsForRound';
import { extractSignalsForRound } from '../services/signal_extraction/extractSignalsForRound';
import { storeKnowledgeForRound } from '../services/knowledge/storeKnowledgeForRound';
import { computeAndStoreNotificationsForRound } from '../services/notifications/computeNotificationsForRound';
import { dispatchQueuedNotifications } from '../services/notifications/dispatchQueuedNotifications';
import { buildPushPayload } from '../services/notifications/buildPushPayload';
import { isPushPipelineEnabled } from '../pushFeature';
import { loadStoredFeedsForCollect } from '../services/feeds/loadStoredFeedsForCollect';
import {
  bookmarkExternalIdFromUrl,
  bookmarkFolderSourceId,
  normalizeBookmarkUrlForId,
} from '../services/bookmarks/bookmarkIds';
import { loadPersonalizationProfile } from '../services/personalization/loadProfile';
import { scoreClusterForPersonalization } from '../services/personalization/scoreCluster';
import { loadHnSignalForCluster } from '../services/personalization/loadHnSignalForCluster';
import { loadAppConfig } from '../config';
import { getPublicRuntimeConfigBody } from '../publicConfig';
import { persistPipelineRoundMetrics } from '../services/metrics/persistPipelineRoundMetrics';
import { isPushApiAuthorized } from '../auth/pushApiToken';
import { maybeEncryptSubscriptionJson } from '../services/push/subscriptionCrypto';
import {
  loadNotificationPolicyChangeLogs,
  loadRuntimeNotificationPolicy,
  saveRuntimeNotificationPolicy,
} from '../services/notifications/runtimePolicy';

type JsonValue = unknown;

function parseTagsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function jsonResponse(res: http.ServerResponse, statusCode: number, body: JsonValue) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export type HomepageResponse = {
  decision_cards: unknown[];
  topic_board: unknown[];
  timeline_feed: unknown[];
};

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function defaultSourceIdFromFeedUrl(feedUrl: string): string {
  return `rss_${sha256Hex(feedUrl)}`;
}

async function runIngestionPipeline(
  db: Database.Database,
  roundId: number,
  nowUtcIso: string,
  uiLang: 'zh' | 'en',
): Promise<{ high: number; medium: number } | { disabled: true }> {
  await normalizeRawItemsForRound(db, roundId, nowUtcIso);
  await clusterNormalizedItemsForRound(db, roundId, nowUtcIso);
  await extractSignalsForRound(db, roundId, uiLang);
  await storeKnowledgeForRound(db, roundId);
  if (isPushPipelineEnabled()) {
    return await computeAndStoreNotificationsForRound(db, roundId, nowUtcIso);
  }
  return { disabled: true as const };
}

export function createApiHandler(db: Database.Database) {
  const appCfg = loadAppConfig();

  return async function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const rawUrl = req.url ?? '';
    const url = rawUrl.split('?')[0] ?? '';
    const method = (req.method ?? 'GET').toUpperCase();
    const normalizeLang = (v: unknown): 'zh' | 'en' => (String(v ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en');

    const assertPushApiAuth = (): boolean => {
      if (isPushApiAuthorized(req, appCfg.pushApiToken)) return true;
      jsonResponse(res, 401, {
        success: false,
        error: 'unauthorized',
        hint: 'Provide Authorization: Bearer <PIH_PUSH_API_TOKEN> or X-PIH-Token header',
      });
      return false;
    };

    if (url === '/api/config' && method === 'GET') {
      const cfg = getPublicRuntimeConfigBody();
      jsonResponse(res, 200, { success: true, ...cfg, notification_policy: loadRuntimeNotificationPolicy(db) });
      return;
    }

    if (url === '/api/notification-policy' && method === 'GET') {
      jsonResponse(res, 200, { success: true, notification_policy: loadRuntimeNotificationPolicy(db) });
      return;
    }

    if (url === '/api/notification-policy' && method === 'PUT') {
      const body = (await readJsonBody(req)) as any;
      const high_threshold = body?.high_threshold;
      const medium_threshold = body?.medium_threshold;
      try {
        const policy = saveRuntimeNotificationPolicy(db, { high_threshold, medium_threshold });
        jsonResponse(res, 200, { success: true, notification_policy: policy });
      } catch (e) {
        if (String((e as Error)?.message ?? e) === 'invalid_threshold_pair') {
          jsonResponse(res, 400, { success: false, error: 'invalid_threshold_pair' });
          return;
        }
        throw e;
      }
      return;
    }

    if (url === '/api/feeds' && method === 'GET') {
      const rows = db
        .prepare(
          `
          SELECT id, source_type, feed_url, source_id, source_name, enabled, sort_order, muted_until_utc, created_at_utc
          FROM rss_feed_configs
          ORDER BY sort_order ASC, id ASC
          `,
        )
        .all();
      jsonResponse(res, 200, { success: true, feeds: rows });
      return;
    }

    if (url === '/api/feeds' && method === 'PATCH') {
      const body = (await readJsonBody(req)) as any;
      const id = Number(body?.id);
      if (!Number.isFinite(id) || id < 1) {
        jsonResponse(res, 400, { success: false, error: 'invalid_id' });
        return;
      }
      const row = db.prepare('SELECT id FROM rss_feed_configs WHERE id = ?').get(id) as { id: number } | undefined;
      if (!row) {
        jsonResponse(res, 404, { success: false, error: 'feed_not_found' });
        return;
      }
      const muteDaysRaw = body?.mute_days;
      if (muteDaysRaw === null || muteDaysRaw === undefined || muteDaysRaw === '') {
        jsonResponse(res, 400, { success: false, error: 'missing_mute_days' });
        return;
      }
      const muteDays = Number(muteDaysRaw);
      if (muteDays === 0) {
        db.prepare('UPDATE rss_feed_configs SET muted_until_utc = NULL WHERE id = ?').run(id);
        jsonResponse(res, 200, { success: true, muted_until_utc: null });
        return;
      }
      if (!Number.isFinite(muteDays) || muteDays < 1 || muteDays > 365) {
        jsonResponse(res, 400, { success: false, error: 'invalid_mute_days' });
        return;
      }
      const until = new Date(Date.now() + muteDays * 86_400_000).toISOString();
      db.prepare('UPDATE rss_feed_configs SET muted_until_utc = ? WHERE id = ?').run(until, id);
      jsonResponse(res, 200, { success: true, muted_until_utc: until });
      return;
    }

    if (url === '/api/feeds/health' && method === 'GET') {
      const rows = db
        .prepare(
          `
          SELECT
            f.id,
            f.feed_url,
            f.source_type,
            f.source_name,
            f.muted_until_utc,
            COALESCE(h.total_fetches, 0) AS total_fetches,
            COALESCE(h.total_successes, 0) AS total_successes,
            COALESCE(h.total_failures, 0) AS total_failures,
            COALESCE(h.consecutive_failures, 0) AS consecutive_failures,
            COALESCE(h.last_status, 'unknown') AS last_status,
            h.last_error,
            h.last_checked_at_utc
          FROM rss_feed_configs f
          LEFT JOIN rss_feed_health_state h ON h.feed_url = f.feed_url
          ORDER BY f.sort_order ASC, f.id ASC
          `,
        )
        .all() as Array<{
        id: number;
        feed_url: string;
        source_type: string;
        source_name: string | null;
        total_fetches: number;
        total_successes: number;
        total_failures: number;
        consecutive_failures: number;
        last_status: string;
        last_error: string | null;
        last_checked_at_utc: string | null;
        muted_until_utc: string | null;
      }>;
      const nowMs = Date.now();
      const withRecommendation = rows.map((r) => {
        const successRate = r.total_fetches > 0 ? r.total_successes / r.total_fetches : null;
        const isMuted = Boolean(r.muted_until_utc && new Date(r.muted_until_utc).getTime() > nowMs);
        let recommendation = 'healthy';
        let recommendation_message = 'Healthy feed.';
        if (isMuted) recommendation = 'muted';
        if (isMuted) {
          recommendation_message = 'Feed is muted; unmute to resume collection.';
        } else if (r.total_fetches === 0) {
          recommendation = 'no_data';
          recommendation_message = 'No collection history yet; run collect once to evaluate.';
        } else if (r.consecutive_failures >= 3) {
          recommendation = 'check_or_mute';
          recommendation_message = 'Consecutive failures detected; check URL/auth/rate-limit or mute temporarily.';
        } else if (successRate != null && successRate < 0.6) {
          recommendation = 'inspect_feed_quality';
          recommendation_message = 'Low success rate; inspect feed stability and adjust source cadence.';
        }
        return {
          ...r,
          success_rate: successRate,
          recommendation,
          recommendation_message,
          is_muted: isMuted,
        };
      });
      jsonResponse(res, 200, { success: true, feeds: withRecommendation });
      return;
    }

    if (url === '/api/feeds' && method === 'POST') {
      const body = (await readJsonBody(req)) as any;
      const source_type =
        body?.source_type === 'tech' ? 'tech' : body?.source_type === 'social' ? 'social' : null;
      if (!source_type) {
        jsonResponse(res, 400, { success: false, error: 'invalid_source_type' });
        return;
      }
      const feed_url = String(body?.feed_url ?? '').trim();
      if (!feed_url || feed_url.length > 4096) {
        jsonResponse(res, 400, { success: false, error: 'invalid_feed_url' });
        return;
      }
      const source_id = body?.source_id != null ? String(body.source_id).trim() || null : null;
      const source_name = body?.source_name != null ? String(body.source_name).trim() || null : null;
      const maxRow = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM rss_feed_configs').get() as { m: number };
      const sort_order = maxRow.m + 1;
      try {
        const info = db
          .prepare(
            `
            INSERT INTO rss_feed_configs (source_type, feed_url, source_id, source_name, enabled, sort_order)
            VALUES (?, ?, ?, ?, 1, ?)
            `,
          )
          .run(source_type, feed_url, source_id, source_name, sort_order);
        const id = Number(info.lastInsertRowid);
        jsonResponse(res, 200, { success: true, id });
      } catch (e: any) {
        if (String(e?.message ?? e).includes('UNIQUE')) {
          jsonResponse(res, 409, { success: false, error: 'feed_url_duplicate' });
          return;
        }
        throw e;
      }
      return;
    }

    if (url === '/api/feeds' && method === 'DELETE') {
      const qs = rawUrl.includes('?') ? rawUrl.split('?')[1] ?? '' : '';
      const params = new URLSearchParams(qs);
      const id = Number(params.get('id'));
      if (!Number.isFinite(id) || id < 1) {
        jsonResponse(res, 400, { success: false, error: 'invalid_id' });
        return;
      }
      const row = db.prepare('SELECT feed_url FROM rss_feed_configs WHERE id = ?').get(id) as { feed_url?: string } | undefined;
      const info = db.prepare('DELETE FROM rss_feed_configs WHERE id = ?').run(id);
      if (row?.feed_url) {
        db.prepare('DELETE FROM rss_feed_health_state WHERE feed_url = ?').run(row.feed_url);
      }
      jsonResponse(res, 200, { success: true, deleted: info.changes });
      return;
    }

    if (url === '/api/collect' && method === 'POST') {
      const nowUtcIso = new Date().toISOString();
      const body = (await readJsonBody(req)) as any;
      const uiLang = normalizeLang(body?.lang);
      const useStoredFeeds = body?.useStoredFeeds === true;
      let sourceTypes: string[] = Array.isArray(body?.source_types) ? body.source_types : [];

      let socialRssFeeds: Array<{ feedUrl: string; sourceId?: string; sourceName?: string }> = Array.isArray(
        body?.socialRssFeeds,
      )
        ? body.socialRssFeeds
        : [];
      let techRssFeeds: Array<{ feedUrl: string; sourceId?: string; sourceName?: string }> = Array.isArray(
        body?.techRssFeeds,
      )
        ? body.techRssFeeds
        : [];

      if (useStoredFeeds) {
        const loaded = loadStoredFeedsForCollect(db);
        socialRssFeeds = loaded.socialRssFeeds;
        techRssFeeds = loaded.techRssFeeds;
        if (socialRssFeeds.length === 0 && techRssFeeds.length === 0) {
          jsonResponse(res, 400, { success: false, error: 'no_feeds_configured' });
          return;
        }
        // Derive sourceTypes from the stored feeds that were loaded
        sourceTypes = ['rss', 'hn', 'bookmark'];
        if (socialRssFeeds.length > 0) sourceTypes.push('social');
        if (techRssFeeds.length > 0) sourceTypes.push('tech');
      } else if (sourceTypes.length === 0) {
        sourceTypes = ['rss', 'hn', 'bookmark'];
        if (socialRssFeeds.length > 0) sourceTypes.push('social');
        if (techRssFeeds.length > 0) sourceTypes.push('tech');
      }

      const info = db
        .prepare('INSERT INTO collection_rounds (status, pipeline_version) VALUES (?, ?)')
        .run('completed', 'v1-rss-placeholder');

      const roundId = Number(info.lastInsertRowid);
      let socialCount = 0;
      let techCount = 0;
      let rssFeedFailures = 0;
      const rssFeedErrors: Array<{ feed_url: string; error: string }> = [];
      const markFeedHealth = db.prepare(
        `
        INSERT INTO rss_feed_health_state
          (feed_url, last_round_id, total_fetches, total_successes, total_failures, consecutive_failures, last_status, last_error, last_checked_at_utc)
        VALUES
          (?, ?, 1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(feed_url) DO UPDATE SET
          last_round_id = excluded.last_round_id,
          total_fetches = rss_feed_health_state.total_fetches + 1,
          total_successes = rss_feed_health_state.total_successes + excluded.total_successes,
          total_failures = rss_feed_health_state.total_failures + excluded.total_failures,
          consecutive_failures = excluded.consecutive_failures,
          last_status = excluded.last_status,
          last_error = excluded.last_error,
          last_checked_at_utc = excluded.last_checked_at_utc
        `,
      );

      async function ingestRssFeeds(params: {
        feeds: Array<{ feedUrl: string; sourceId?: string; sourceName?: string }>;
        sourceType: 'social' | 'tech';
      }): Promise<number> {
        let inserted = 0;
        for (const feed of params.feeds) {
          if (!feed?.feedUrl) continue;
          const sourceId = feed.sourceId ?? defaultSourceIdFromFeedUrl(feed.feedUrl);
          const sourceName = feed.sourceName ?? sourceId;

          let items: RawItem[];
          try {
            items = await collectRssFromUrl({
              feedUrl: feed.feedUrl,
              sourceId,
              sourceName,
              nowUtcIso,
              language: 'en',
            });
          } catch (e) {
            rssFeedFailures += 1;
            const err = String((e as Error)?.message ?? e);
            rssFeedErrors.push({ feed_url: feed.feedUrl, error: err });
            const prev = db
              .prepare('SELECT consecutive_failures FROM rss_feed_health_state WHERE feed_url = ?')
              .get(feed.feedUrl) as { consecutive_failures?: number } | undefined;
            const nextConsecutive = Number(prev?.consecutive_failures ?? 0) + 1;
            markFeedHealth.run(feed.feedUrl, roundId, 0, 1, nextConsecutive, 'failure', err, nowUtcIso);
            continue;
          }
          markFeedHealth.run(feed.feedUrl, roundId, 1, 0, 0, 'success', null, nowUtcIso);

          const stmt = db.prepare(
            `INSERT INTO raw_items
            (collection_round_id, source_type, source_id, source_name, external_id, title, published_at, collected_at, url, excerpt_or_summary, author, language, timestamp_quality, source_metadata_json)
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          for (const item of items) {
            stmt.run(
              roundId,
              params.sourceType,
              item.source_id,
              sourceName,
              item.external_id,
              item.title,
              item.published_at ?? null,
              item.collected_at,
              item.url,
              item.excerpt_or_summary ?? null,
              item.author ?? null,
              item.language,
              item.timestamp_quality,
              null
            );
            inserted += 1;
          }
        }
        return inserted;
      }

      if (sourceTypes.includes('social') && socialRssFeeds.length > 0) {
        socialCount = await ingestRssFeeds({ feeds: socialRssFeeds, sourceType: 'social' });
      }
      if (sourceTypes.includes('tech') && techRssFeeds.length > 0) {
        techCount = await ingestRssFeeds({ feeds: techRssFeeds, sourceType: 'tech' });
      }

      let hnCount = 0;
      if (sourceTypes.includes('hn')) {
        const { fetchHnStories, loadHnAdapterConfig } = await import('../adapters/hackernews');
        const hnCfg = loadHnAdapterConfig(process.env);

        // Load previous positions from hn_position_tracking (most recent round per hn_id)
        const prevRows = db.prepare(`
          SELECT hn_id, position
          FROM hn_position_tracking
          WHERE collection_round_id = (
            SELECT MAX(collection_round_id) FROM hn_position_tracking
          )
        `).all() as Array<{ hn_id: number; position: number }>;
        const prevPositions = new Map<number, number>();
        for (const r of prevRows) prevPositions.set(r.hn_id, r.position);

        const hnResult = await fetchHnStories(hnCfg, prevPositions, nowUtcIso);

        if (hnResult.ok) {
          // Insert HN stories into raw_items
          const hnStmt = db.prepare(`
            INSERT INTO raw_items
              (collection_round_id, source_type, source_id, source_name, external_id, title, published_at, collected_at, url, excerpt_or_summary, author, language, timestamp_quality, source_metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const story of hnResult.stories) {
            const sourceId = `hn_${story.story_type}`;
            hnStmt.run(
              roundId,
              'hn',
              sourceId,
              `Hacker News ${story.story_type}`,
              `hn_${story.hn_id}`,
              story.title,
              nowUtcIso,
              nowUtcIso,
              story.url,
              null,
              story.author,
              'en',
              'missing',
              JSON.stringify({
                hn_id: story.hn_id,
                hn_url: story.hn_url,
                position: story.position,
                prev_position: story.prev_position,
                velocity: story.velocity,
                score: story.score,
                comment_count: story.comment_count,
                author: story.author,
                story_type: story.story_type,
                fetched_at: story.fetched_at,
              }),
            );
            hnCount++;
          }

          // Write position tracking
          const trackStmt = db.prepare(`
            INSERT OR REPLACE INTO hn_position_tracking (hn_id, collection_round_id, position, velocity, fetched_at)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const story of hnResult.stories) {
            trackStmt.run(story.hn_id, roundId, story.position, story.velocity ?? 0, nowUtcIso);
          }
        }
      }

      const notifications = await runIngestionPipeline(db, roundId, nowUtcIso, uiLang);
      persistPipelineRoundMetrics(db, roundId, { rssFeedFailures, notifications });

      jsonResponse(res, 200, {
        success: true,
        round_id: roundId,
        ingested: { social: socialCount, tech: techCount, hn: hnCount },
        rss_feed_failures: rssFeedFailures,
        rss_feed_errors: rssFeedErrors,
        notifications,
      });
      return;
    }

    if (url === '/api/import/bookmarks' && method === 'POST') {
      const body = (await readJsonBody(req)) as any;
      const uiLang = normalizeLang(body?.lang);
      const items = Array.isArray(body?.items) ? body.items : [];
      if (items.length === 0) {
        jsonResponse(res, 400, { success: false, error: 'empty_items' });
        return;
      }
      if (items.length > 500) {
        jsonResponse(res, 400, { success: false, error: 'too_many_items' });
        return;
      }

      const nowUtcIso = new Date().toISOString();
      const roundInfo = db
        .prepare('INSERT INTO collection_rounds (status, pipeline_version) VALUES (?, ?)')
        .run('completed', 'v1-bookmark-import');
      const roundId = Number(roundInfo.lastInsertRowid);

      const stmt = db.prepare(
        `
        INSERT INTO raw_items
          (collection_round_id, source_type, source_id, source_name, external_id, title, published_at, collected_at, url, excerpt_or_summary, author, language, timestamp_quality, source_metadata_json)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      );

      const seen = new Set<string>();
      let inserted = 0;

      function truncateTitle(s: string, max: number): string {
        if (s.length <= max) return s;
        return `${s.slice(0, Math.max(0, max - 3))}...`;
      }

      for (const raw of items) {
        const urlStr = String(raw?.url ?? '').trim();
        const normalized = normalizeBookmarkUrlForId(urlStr);
        if (!normalized) continue;
        const extId = bookmarkExternalIdFromUrl(urlStr);
        if (!extId || seen.has(extId)) continue;
        seen.add(extId);

        const titleRaw = String(raw?.title ?? '').trim();
        const title = truncateTitle(titleRaw || normalized, 500);
        const folder = String(raw?.folder ?? '').trim();
        const note = raw?.note != null ? String(raw.note).trim() : '';
        const source_name = folder || 'Bookmarks';
        const source_id = bookmarkFolderSourceId(folder);

        let published_at: string | null = null;
        const added = raw?.addedAt ?? raw?.added_at;
        if (typeof added === 'string' && added.trim()) {
          const t = Date.parse(added.trim());
          if (!Number.isNaN(t)) published_at = new Date(t).toISOString();
        }

        stmt.run(
          roundId,
          'bookmark',
          source_id,
          source_name,
          extId,
          title,
          published_at,
          nowUtcIso,
          normalized,
          note || null,
          null,
          'en',
          'missing',
          null,
        );
        inserted += 1;
      }

      if (inserted === 0) {
        db.prepare('DELETE FROM collection_rounds WHERE id = ?').run(roundId);
        jsonResponse(res, 400, { success: false, error: 'no_valid_bookmarks' });
        return;
      }

      const notifications = await runIngestionPipeline(db, roundId, nowUtcIso, uiLang);
      persistPipelineRoundMetrics(db, roundId, { rssFeedFailures: 0, notifications });
      jsonResponse(res, 200, {
        success: true,
        round_id: roundId,
        inserted,
        skipped: items.length - inserted,
        notifications,
      });
      return;
    }

    if (url === '/api/seed/test-data' && method === 'POST') {
      const body = (await readJsonBody(req)) as any;
      const scenario = String(body?.scenario ?? 'single_round');
      const uiLang = normalizeLang(body?.lang);

      const stmtRound = db.prepare('INSERT INTO collection_rounds (status, pipeline_version) VALUES (?, ?)');
      const stmtRaw = db.prepare(
        `
        INSERT INTO raw_items
          (collection_round_id, source_type, source_id, source_name, external_id, title, published_at, collected_at, url, excerpt_or_summary, author, language, timestamp_quality, source_metadata_json)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      );

      async function runSeedRound(items: Array<{
        source_type: 'social' | 'tech';
        source_id: string;
        source_name: string;
        external_id: string;
        title: string;
        url: string;
        excerpt_or_summary: string;
      }>): Promise<number> {
        const nowUtcIso = new Date().toISOString();
        const info = stmtRound.run('completed', 'v1-seed-test-data');
        const roundId = Number(info.lastInsertRowid);

        for (const it of items) {
          stmtRaw.run(
            roundId,
            it.source_type,
            it.source_id,
            it.source_name,
            it.external_id,
            it.title,
            nowUtcIso,
            nowUtcIso,
            it.url,
            it.excerpt_or_summary,
            'Seed Author',
            'en',
            'missing',
            null,
          );
        }

        await normalizeRawItemsForRound(db, roundId, nowUtcIso);
        await clusterNormalizedItemsForRound(db, roundId, nowUtcIso);
        await extractSignalsForRound(db, roundId, uiLang);
        await storeKnowledgeForRound(db, roundId);
        return roundId;
      }

      const round1Id = await runSeedRound([
        {
          source_type: 'social',
          source_id: 'seed_social_1',
          source_name: 'seed_social',
          external_id: 'seed-social-a',
          title: 'Seed Social A',
          url: 'https://example.com/social/a',
          excerpt_or_summary: 'Social Seed content for testing.',
        },
        {
          source_type: 'tech',
          source_id: 'seed_tech_1',
          source_name: 'seed_tech',
          external_id: 'seed-tech-a',
          title: 'Seed Tech A',
          url: 'https://example.com/tech/a',
          excerpt_or_summary: 'Tech Seed content for testing.',
        },
      ]);

      let round2Id: number | null = null;
      if (scenario === 'two_rounds') {
        // Keep same source_id so cluster_id remains stable; change one external_id to trigger event_update.
        round2Id = await runSeedRound([
          {
            source_type: 'social',
            source_id: 'seed_social_1',
            source_name: 'seed_social',
            external_id: 'seed-social-b',
            title: 'Seed Social B',
            url: 'https://example.com/social/b',
            excerpt_or_summary: 'Social Seed content for testing (round2 changed evidence).',
          },
          {
            source_type: 'tech',
            source_id: 'seed_tech_1',
            source_name: 'seed_tech',
            external_id: 'seed-tech-a',
            title: 'Seed Tech A',
            url: 'https://example.com/tech/a',
            excerpt_or_summary: 'Tech Seed content for testing.',
          },
        ]);
      }

      const targetRoundId = round2Id ?? round1Id;
      const normalizedCount = db
        .prepare('SELECT COUNT(*) as cnt FROM normalized_items WHERE collection_round_id = ?')
        .get(targetRoundId) as { cnt: number };

      const clustersCount = db
        .prepare(
          `
          SELECT COUNT(DISTINCT c.cluster_id) as cnt
          FROM clusters c
          JOIN cluster_evidence ce ON ce.cluster_id = c.cluster_id
          JOIN normalized_items n ON n.id = ce.normalized_item_id
          WHERE n.collection_round_id = ?
          `,
        )
        .get(targetRoundId) as { cnt: number };

      const knowledgeCount = db
        .prepare(
          `
          SELECT COUNT(*) as cnt
          FROM knowledge_entries ke
          JOIN clusters c ON c.cluster_id = ke.cluster_id
          JOIN cluster_evidence ce ON ce.cluster_id = c.cluster_id
          JOIN normalized_items n ON n.id = ce.normalized_item_id
          WHERE n.collection_round_id = ?
          `,
        )
        .get(targetRoundId) as { cnt: number };

      const kinds = db
        .prepare(
          `
          SELECT cluster_kind, COUNT(*) as cnt
          FROM cluster_timeline_state
          WHERE collection_round_id = ?
          GROUP BY cluster_kind
          `,
        )
        .all(targetRoundId) as Array<{ cluster_kind: string; cnt: number }>;
      const kindSummary = kinds.reduce<Record<string, number>>((acc, r) => {
        acc[r.cluster_kind] = r.cnt;
        return acc;
      }, {});

      jsonResponse(res, 200, {
        success: true,
        scenario,
        round_1_id: round1Id,
        round_2_id: round2Id,
        round_id: targetRoundId,
        normalized_items: normalizedCount.cnt,
        clusters: clustersCount.cnt,
        knowledge_entries: knowledgeCount.cnt,
        cluster_kind_summary: kindSummary,
        notifications: { disabled: true },
      });
      return;
    }

    if (url === '/api/personalization' && method === 'GET') {
      const keywords = db
        .prepare(`SELECT id, mode, keyword FROM personalization_keyword_rules ORDER BY mode ASC, keyword ASC`)
        .all();
      const personaRows = db
        .prepare(`SELECT id, name, keywords_json, weight FROM personalization_personas ORDER BY id ASC`)
        .all() as Array<{ id: number; name: string; keywords_json: string; weight: number }>;
      const feedback = db
        .prepare(
          `SELECT cluster_id, sentiment, saved, updated_at_utc FROM personalization_feedback ORDER BY updated_at_utc DESC LIMIT 500`,
        )
        .all();
      jsonResponse(res, 200, {
        success: true,
        keywords,
        personas: personaRows.map((p) => ({
          id: p.id,
          name: p.name,
          weight: p.weight,
          keywords: (() => {
            try {
              const j = JSON.parse(p.keywords_json || '[]');
              return Array.isArray(j) ? j : [];
            } catch {
              return [];
            }
          })(),
        })),
        feedback,
      });
      return;
    }

    if (url === '/api/personalization' && method === 'PUT') {
      const body = (await readJsonBody(req)) as any;
      const keywords = Array.isArray(body?.keywords) ? body.keywords : [];
      const personas = Array.isArray(body?.personas) ? body.personas : [];
      if (keywords.length > 200 || personas.length > 30) {
        jsonResponse(res, 400, { success: false, error: 'limits_exceeded' });
        return;
      }

      const txn = db.transaction(() => {
        db.prepare('DELETE FROM personalization_keyword_rules').run();
        db.prepare('DELETE FROM personalization_personas').run();
        const insK = db.prepare('INSERT INTO personalization_keyword_rules (mode, keyword) VALUES (?, ?)');
        for (const k of keywords) {
          const mode = k?.mode === 'deny' ? 'deny' : 'allow';
          const kw = String(k?.keyword ?? '')
            .trim()
            .slice(0, 160);
          if (!kw) continue;
          insK.run(mode, kw);
        }
        const insP = db.prepare(
          'INSERT INTO personalization_personas (name, keywords_json, weight) VALUES (?, ?, ?)',
        );
        for (const p of personas) {
          const name = String(p?.name ?? '')
            .trim()
            .slice(0, 100);
          const kws = Array.isArray(p?.keywords)
            ? p.keywords
                .map((x: unknown) => String(x).trim())
                .filter(Boolean)
                .slice(0, 80)
            : [];
          const w = typeof p?.weight === 'number' && Number.isFinite(p.weight) ? p.weight : 1;
          insP.run(name || 'persona', JSON.stringify(kws), w);
        }
      });
      txn();
      jsonResponse(res, 200, { success: true });
      return;
    }

    if (url === '/api/personalization/feedback' && method === 'POST') {
      const body = (await readJsonBody(req)) as any;
      const cluster_id = String(body?.cluster_id ?? '').trim();
      if (!cluster_id) {
        jsonResponse(res, 400, { success: false, error: 'missing_cluster_id' });
        return;
      }
      if (body?.sentiment !== undefined) {
        const s = Number(body.sentiment);
        if (s !== -1 && s !== 0 && s !== 1) {
          jsonResponse(res, 400, { success: false, error: 'invalid_sentiment' });
          return;
        }
      }
      const existing = db
        .prepare('SELECT sentiment, saved FROM personalization_feedback WHERE cluster_id = ?')
        .get(cluster_id) as { sentiment: number; saved: number } | undefined;
      const profileBefore = loadPersonalizationProfile(db);
      const scoreInput = db
        .prepare(
          `
          SELECT ke.content_summary, ke.snippet_text, ke.tags_json
          FROM knowledge_entries ke
          WHERE ke.cluster_id = ?
          LIMIT 1
          `,
        )
        .get(cluster_id) as
        | {
            content_summary: string;
            snippet_text: string;
            tags_json: string;
          }
        | undefined;
      const nextS = body?.sentiment !== undefined ? Number(body.sentiment) : (existing?.sentiment ?? 0);
      const nextSaved =
        body?.saved !== undefined ? (body.saved === true || body.saved === 1 ? 1 : 0) : (existing?.saved ?? 0);
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO personalization_feedback (cluster_id, sentiment, saved, updated_at_utc)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(cluster_id) DO UPDATE SET
          sentiment = excluded.sentiment,
          saved = excluded.saved,
          updated_at_utc = excluded.updated_at_utc
        `,
      ).run(cluster_id, nextS, nextSaved, now);
      const profileAfter = loadPersonalizationProfile(db);
      let impact:
        | {
            before_score: number;
            after_score: number;
            delta: number;
          }
        | undefined;
      const hnSignal = loadHnSignalForCluster(db, cluster_id);
      if (scoreInput) {
        let tags: string[] = [];
        try {
          const parsed = JSON.parse(scoreInput.tags_json);
          if (Array.isArray(parsed)) tags = parsed.map((x) => String(x));
        } catch {
          tags = [];
        }
        const before = scoreClusterForPersonalization(
          {
            cluster_id,
            content_summary: scoreInput.content_summary,
            snippet_text: scoreInput.snippet_text,
            tags,
            hn_signal: hnSignal,
          },
          profileBefore,
        ).score;
        const after = scoreClusterForPersonalization(
          {
            cluster_id,
            content_summary: scoreInput.content_summary,
            snippet_text: scoreInput.snippet_text,
            tags,
            hn_signal: hnSignal,
          },
          profileAfter,
        ).score;
        impact = {
          before_score: Number(before.toFixed(4)),
          after_score: Number(after.toFixed(4)),
          delta: Number((after - before).toFixed(4)),
        };
      }
      jsonResponse(res, 200, {
        success: true,
        cluster_id,
        sentiment: nextS,
        saved: Boolean(nextSaved),
        impact,
      });
      return;
    }

    if (url === '/api/homepage' && method === 'GET') {
      const latest = db.prepare('SELECT id FROM collection_rounds ORDER BY id DESC LIMIT 1').get() as
        | { id: number }
        | undefined;

      if (!latest) {
        jsonResponse(res, 200, { decision_cards: [], topic_board: [], timeline_feed: [] } satisfies HomepageResponse);
        return;
      }

      const roundId = latest.id;

      // Build decision cards from decision_signals (v1 placeholder signals).
      // For each cluster, attach the "first evidence" normalized_item in this round so we can show source/title.
      const rows = db
        .prepare(
          `
          WITH first_evidence AS (
            SELECT
              ce.cluster_id,
              MIN(n.id) AS normalized_item_id
            FROM cluster_evidence ce
            JOIN normalized_items n ON n.id = ce.normalized_item_id
            WHERE n.collection_round_id = ?
            GROUP BY ce.cluster_id
          )
          SELECT
            ds.cluster_id,
            ds.signal_schema_version,
            ds.change_policy_used,
            ds.signals_json,
            COALESCE(tls.cluster_kind, 'topic_drift') as cluster_kind,
            n.source_type,
            n.source_id,
            n.external_id,
            n.title,
            n.published_at,
            r.collected_at,
            n.url,
            n.author,
            n.language,
            n.timestamp_quality,
            n.content_summary,
            n.content_text_or_excerpt,
            ke.tags_json AS knowledge_tags_json
          FROM decision_signals ds
          JOIN first_evidence fe ON fe.cluster_id = ds.cluster_id
          JOIN normalized_items n ON n.id = fe.normalized_item_id
          JOIN raw_items r ON r.id = n.raw_item_id
          LEFT JOIN cluster_timeline_state tls
            ON tls.cluster_id = ds.cluster_id
            AND tls.collection_round_id = ?
          LEFT JOIN knowledge_entries ke ON ke.cluster_id = ds.cluster_id
          ORDER BY r.collected_at DESC, ds.cluster_id ASC
          `
        )
        .all(roundId, roundId) as Array<any>;

      if (rows.length === 0) {
        jsonResponse(res, 200, { decision_cards: [], topic_board: [], timeline_feed: [] } satisfies HomepageResponse);
        return;
      }

      const profile = loadPersonalizationProfile(db);

      const cardsRaw = rows.map((r) => {
        let parsedSignals: any = null;
        try {
          parsedSignals = JSON.parse(r.signals_json);
        } catch {
          parsedSignals = null;
        }

        const changeSummary: string = parsedSignals?.change?.change_summary ?? '';
        const tags = parseTagsJson(r.knowledge_tags_json);

        return {
          id: r.cluster_id,
          cluster_id: r.cluster_id,
          source_type: r.source_type,
          source_id: r.source_id,
          cluster_kind: r.cluster_kind,
          external_id: r.external_id,
          title: r.title,
          published_at: r.published_at,
          collected_at: r.collected_at,
          url: r.url,
          author: r.author,
          language: r.language,
          timestamp_quality: r.timestamp_quality,
          content_summary: r.content_summary,
          content_text_or_excerpt: r.content_text_or_excerpt,
          change_summary: changeSummary,
          _tags: tags,
        };
      });

      const cardsScored = cardsRaw.map((c) => {
        const hnSignal = loadHnSignalForCluster(db, c.cluster_id);
        const sc = scoreClusterForPersonalization(
          {
            cluster_id: c.cluster_id,
            content_summary: String(c.content_summary ?? ''),
            snippet_text: `${String(c.content_text_or_excerpt ?? '')}\n${String(c.change_summary ?? '')}`,
            tags: c._tags,
            hn_signal: hnSignal,
          },
          profile,
        );
        const { _tags, ...rest } = c;
        return {
          ...rest,
          personalization_score: sc.score,
          personalization_reasons: sc.reasons,
          _denied: sc.denied,
        };
      });

      const cards = cardsScored
        .filter((c) => !c._denied)
        .map(({ _denied, ...out }) => out);

      cards.sort((a, b) => {
        if (b.personalization_score !== a.personalization_score) {
          return b.personalization_score - a.personalization_score;
        }
        const pa = a.cluster_kind === 'event_update' ? 0 : 1;
        const pb = b.cluster_kind === 'event_update' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return String(a.cluster_id).localeCompare(String(b.cluster_id));
      });

      function labelFromSummary(summary: string): string {
        const m = summary.match(/[A-Za-z0-9][A-Za-z0-9_-]+/);
        if (m) return m[0].slice(0, 24);
        // Fallback for CJK: take first 8 chars.
        return summary.slice(0, 8);
      }

      // Topic board: deterministic grouping by labelFromSummary(content_summary).
      const topicMap = new Map<string, { topic: string; count: number; top_card?: any }>();
      for (const c of cards) {
        const topic = labelFromSummary(String(c.content_summary ?? c.change_summary ?? ''));
        const prev = topicMap.get(topic);
        if (!prev) {
          topicMap.set(topic, { topic, count: 1, top_card: c });
        } else {
          prev.count += 1;
        }
      }

      const topic_board = Array.from(topicMap.values()).sort((a, b) => b.count - a.count);

      const payload: HomepageResponse = {
        decision_cards: cards,
        topic_board,
        timeline_feed: cards,
      };

      jsonResponse(res, 200, payload);
      return;
    }

    if (url === '/api/knowledge/search' && method === 'GET') {
      const reqUrl = new URL(req.url ?? '', 'http://localhost');
      const q = String(reqUrl.searchParams.get('q') ?? '').trim();
      if (!q) {
        jsonResponse(res, 200, { results: [] });
        return;
      }

      const tagFilters = String(reqUrl.searchParams.get('tags') ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const sqlLimit = tagFilters.length > 0 ? 100 : 20;

      const rows = db
        .prepare(
          `
          WITH latest_timeline AS (
            SELECT t1.cluster_id, t1.cluster_kind
            FROM cluster_timeline_state t1
            WHERE t1.collection_round_id = (
              SELECT MAX(t2.collection_round_id)
              FROM cluster_timeline_state t2
              WHERE t2.cluster_id = t1.cluster_id
            )
          )
          SELECT
            ke.cluster_id,
            ke.content_summary,
            ke.snippet_text,
            ke.tags_json,
            COALESCE(lt.cluster_kind, 'topic_drift') as cluster_kind
          FROM knowledge_entries ke
          LEFT JOIN latest_timeline lt ON lt.cluster_id = ke.cluster_id
          WHERE ke.content_summary LIKE ? OR ke.snippet_text LIKE ? OR ke.tags_json LIKE ?
          ORDER BY ke.id DESC
          LIMIT ?
          `,
        )
        .all(`%${q}%`, `%${q}%`, `%${q}%`, sqlLimit) as Array<{
        cluster_id: string;
        content_summary: string;
        snippet_text: string;
        tags_json: string;
        cluster_kind: string;
      }>;

      const profile = loadPersonalizationProfile(db);

      let parsedRows = rows.map((r) => {
        let tags: string[] = [];
        try {
          tags = JSON.parse(r.tags_json) as string[];
          if (!Array.isArray(tags)) tags = [];
        } catch {
          tags = [];
        }
        return { ...r, tags };
      });

      if (tagFilters.length > 0) {
        parsedRows = parsedRows.filter((r) =>
          tagFilters.some((tf) =>
            r.tags.some((t) => {
              const tl = String(t).toLowerCase();
              return tl === tf || tl.includes(tf);
            }),
          ),
        );
      }

      const scored = parsedRows.map((r) => {
        const hnSignal = loadHnSignalForCluster(db, r.cluster_id);
        const sc = scoreClusterForPersonalization(
          {
            cluster_id: r.cluster_id,
            content_summary: r.content_summary,
            snippet_text: r.snippet_text,
            tags: r.tags,
            hn_signal: hnSignal,
          },
          profile,
        );
        return {
          cluster_id: r.cluster_id,
          content_summary: r.content_summary,
          snippet_text: r.snippet_text,
          cluster_kind: r.cluster_kind,
          level: r.cluster_kind === 'event_update' ? 'HIGH' : 'MEDIUM',
          tags: r.tags,
          personalization_score: sc.score,
          personalization_reasons: sc.reasons,
          _denied: sc.denied,
        };
      });

      let results = scored
        .filter((x) => !x._denied)
        .map(({ _denied, ...rest }) => rest)
        .sort((a, b) => {
          if (b.personalization_score !== a.personalization_score) {
            return b.personalization_score - a.personalization_score;
          }
          return String(a.cluster_id).localeCompare(String(b.cluster_id));
        });

      results = results.slice(0, 20);

      jsonResponse(res, 200, { results });
      return;
    }

    if (url === '/api/knowledge/cluster' && method === 'GET') {
      const reqUrl = new URL(req.url ?? '', 'http://localhost');
      const clusterId = String(reqUrl.searchParams.get('cluster_id') ?? '').trim();
      if (!clusterId) {
        jsonResponse(res, 400, { success: false, error: 'missing cluster_id' });
        return;
      }

      const loadKnowledge = (id: string) =>
        db
          .prepare(
            `
          SELECT
            cluster_id,
            content_summary,
            snippet_text,
            tags_json,
            entry_json
          FROM knowledge_entries
          WHERE cluster_id = ?
          LIMIT 1
          `,
          )
          .get(id) as
          | {
              cluster_id: string;
              content_summary: string;
              snippet_text: string;
              tags_json: string;
              entry_json: string;
            }
          | undefined;

      let row = loadKnowledge(clusterId);
      if (!row) {
        const rootId = resolveEvidenceRootClusterId(db, clusterId);
        if (rootId !== clusterId) row = loadKnowledge(rootId);
      }

      if (!row) {
        jsonResponse(res, 404, { success: false, error: 'cluster_not_found' });
        return;
      }

      let entryJson: any = null;
      try {
        entryJson = JSON.parse(row.entry_json);
      } catch {
        entryJson = null;
      }

      const evidenceLinks = Array.isArray(entryJson?.change?.evidence_links)
        ? entryJson.change.evidence_links
        : [];
      const timeline = evidenceLinks.map((l: any, idx: number) => ({
        id: `${clusterId}_${idx}`,
        role: String(l?.role ?? 'context'),
        link_confidence: Number(l?.link_confidence ?? 0),
        url: String(l?.evidence_ref?.url ?? ''),
        published_at: String(l?.evidence_ref?.published_at ?? ''),
        snippet_text: String(l?.evidence_snippet?.snippet_text ?? ''),
      }));

      jsonResponse(res, 200, {
        success: true,
        cluster_id: row.cluster_id,
        content_summary: row.content_summary,
        snippet_text: row.snippet_text,
        tags: JSON.parse(row.tags_json) as string[],
        timeline,
      });
      return;
    }

    if (url === '/api/demo/status' && method === 'GET') {
      const rt = getPublicRuntimeConfigBody();
      const effectivePolicy = loadRuntimeNotificationPolicy(db);

      const latestRound = db
        .prepare('SELECT MAX(id) as maxId FROM collection_rounds')
        .get() as { maxId: number | null };
      const latestRoundId = latestRound.maxId;

      const stmtRoundMetrics = db.prepare(
        `
        SELECT round_id, notifications_high, notifications_medium, rss_feed_failures
        FROM pipeline_round_metrics
        WHERE round_id = ?
        `,
      );
      const stmtRecentRoundMetrics = db.prepare(
        `
        SELECT prm.round_id, prm.notifications_high, prm.notifications_medium, prm.rss_feed_failures, cr.created_at_utc
        FROM pipeline_round_metrics prm
        JOIN collection_rounds cr ON cr.id = prm.round_id
        ORDER BY prm.round_id DESC
        LIMIT 10
        `,
      );
      const stmtReviewRoundMetrics = db.prepare(
        `
        SELECT prm.round_id, prm.notifications_high, prm.notifications_medium, prm.rss_feed_failures, cr.created_at_utc
        FROM pipeline_round_metrics prm
        JOIN collection_rounds cr ON cr.id = prm.round_id
        ORDER BY prm.round_id DESC
        LIMIT 60
        `,
      );

      if (!latestRoundId) {
        jsonResponse(res, 200, {
          success: true,
          latest_round_id: null,
          normalized_items: 0,
          clusters: 0,
          decision_signals: 0,
          knowledge_entries: 0,
          cluster_kind_summary: {},
          notification_policy: effectivePolicy,
          signal_extractor: rt.signal_extractor,
          push_pipeline_enabled: rt.push_pipeline_enabled,
          rss_fetch: rt.rss_fetch,
          llm_configured: rt.llm_configured,
          metrics: { latest_round: null, recent_rounds: [] },
          policy_tuning: {
            current: effectivePolicy,
            recent_changes: loadNotificationPolicyChangeLogs(db, 10),
            review_windows: [],
          },
        });
        return;
      }

      const normalized = db
        .prepare('SELECT COUNT(*) as cnt FROM normalized_items WHERE collection_round_id = ?')
        .get(latestRoundId) as { cnt: number };

      const clusters = db
        .prepare(
          `
          SELECT COUNT(DISTINCT ce.cluster_id) as cnt
          FROM cluster_evidence ce
          JOIN normalized_items n ON n.id = ce.normalized_item_id
          WHERE n.collection_round_id = ?
          `,
        )
        .get(latestRoundId) as { cnt: number };

      const signals = db
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

      const knowledge = db
        .prepare(
          `
          SELECT COUNT(*) as cnt
          FROM knowledge_entries ke
          WHERE ke.cluster_id IN (
            SELECT DISTINCT ce.cluster_id
            FROM cluster_evidence ce
            JOIN normalized_items n ON n.id = ce.normalized_item_id
            WHERE n.collection_round_id = ?
          )
          `,
        )
        .get(latestRoundId) as { cnt: number };

      const kinds = db
        .prepare(
          `
          SELECT cluster_kind, COUNT(*) as cnt
          FROM cluster_timeline_state
          WHERE collection_round_id = ?
          GROUP BY cluster_kind
          `,
        )
        .all(latestRoundId) as Array<{ cluster_kind: string; cnt: number }>;
      const clusterKindSummary = kinds.reduce<Record<string, number>>((acc, r) => {
        acc[r.cluster_kind] = r.cnt;
        return acc;
      }, {});

      const banned = ['full_text', 'body_html', 'original_body'];
      const knowledgeTableColumns = db
        .prepare(`PRAGMA table_info('knowledge_entries')`)
        .all() as Array<{ name: string }>;
      const colNames = new Set(knowledgeTableColumns.map((c) => c.name));
      const hasForbiddenKnowledgeColumns = banned.some((b) => colNames.has(b));

      const signalsRows = db
        .prepare(
          `
          SELECT ds.signals_json
          FROM decision_signals ds
          JOIN cluster_evidence ce ON ce.cluster_id = ds.cluster_id
          JOIN normalized_items n ON n.id = ce.normalized_item_id
          WHERE n.collection_round_id = ?
          `,
        )
        .all(latestRoundId) as Array<{ signals_json: string }>;
      const knowledgeRows = db
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
        .all(latestRoundId) as Array<{ entry_json: string; snippet_text: string }>;

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

      let maxSignalSnippetLength = 0;
      let hasForbiddenJsonKeys = false;
      for (const row of signalsRows) {
        let parsed: any = null;
        try {
          parsed = JSON.parse(row.signals_json);
        } catch {
          parsed = null;
        }
        if (!parsed) continue;
        const keys = new Set<string>();
        collectKeysDeep(parsed, keys);
        if (banned.some((b) => keys.has(b))) hasForbiddenJsonKeys = true;
        const links = Array.isArray(parsed?.change?.evidence_links) ? parsed.change.evidence_links : [];
        for (const l of links) {
          const snippet = String(l?.evidence_snippet?.snippet_text ?? '');
          if (snippet.length > maxSignalSnippetLength) maxSignalSnippetLength = snippet.length;
        }
      }

      let maxKnowledgeSnippetLength = 0;
      for (const row of knowledgeRows) {
        if (row.snippet_text.length > maxKnowledgeSnippetLength) {
          maxKnowledgeSnippetLength = row.snippet_text.length;
        }
        let parsed: any = null;
        try {
          parsed = JSON.parse(row.entry_json);
        } catch {
          parsed = null;
        }
        if (!parsed) continue;
        const keys = new Set<string>();
        collectKeysDeep(parsed, keys);
        if (banned.some((b) => keys.has(b))) hasForbiddenJsonKeys = true;
      }

      const privacyChecks = {
        pass:
          !hasForbiddenKnowledgeColumns &&
          !hasForbiddenJsonKeys &&
          maxSignalSnippetLength <= 600 &&
          maxKnowledgeSnippetLength <= 600,
        details: {
          has_forbidden_knowledge_columns: hasForbiddenKnowledgeColumns,
          has_forbidden_json_keys: hasForbiddenJsonKeys,
          max_signal_snippet_length: maxSignalSnippetLength,
          max_knowledge_snippet_length: maxKnowledgeSnippetLength,
        },
      };

      const notifRows = db
        .prepare(
          `
          SELECT status, COUNT(*) as cnt
          FROM notification_event_log
          GROUP BY status
          `,
        )
        .all() as Array<{ status: string; cnt: number }>;
      const notificationSummary = notifRows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = r.cnt;
        return acc;
      }, {});
      const notificationCounts = {
        queued: notificationSummary.queued ?? 0,
        sent: notificationSummary.sent ?? 0,
        failed: (notificationSummary.failed_push ?? 0) + (notificationSummary.failed_bad_payload ?? 0),
        skipped: notificationSummary.skipped_no_subscription ?? 0,
      };
      const nowIsoForFeeds = new Date().toISOString();
      const activeFeedsRow = db
        .prepare(
          `
          SELECT COUNT(*) as cnt FROM rss_feed_configs
          WHERE enabled = 1
            AND (
              muted_until_utc IS NULL
              OR muted_until_utc = ''
              OR muted_until_utc <= ?
            )
          `,
        )
        .get(nowIsoForFeeds) as { cnt: number };
      const activeFeedsCount = Number(activeFeedsRow.cnt ?? 0);

      const roundMetricsRow = stmtRoundMetrics.get(latestRoundId) as
        | {
            round_id: number;
            notifications_high: number;
            notifications_medium: number;
            rss_feed_failures: number;
          }
        | undefined;
      const recentRoundRows = stmtRecentRoundMetrics.all() as Array<{
        round_id: number;
        notifications_high: number;
        notifications_medium: number;
        rss_feed_failures: number;
        created_at_utc: string;
      }>;
      const reviewRoundRows = stmtReviewRoundMetrics.all() as Array<{
        round_id: number;
        notifications_high: number;
        notifications_medium: number;
        rss_feed_failures: number;
        created_at_utc: string;
      }>;
      const enrichRoundMetrics = (r: {
        round_id: number;
        notifications_high: number;
        notifications_medium: number;
        rss_feed_failures: number;
        created_at_utc?: string;
      }) => {
        const total = r.notifications_high + r.notifications_medium;
        const noise_ratio = total > 0 ? r.notifications_medium / total : 0;
        const ingest_health =
          activeFeedsCount > 0
            ? Math.max(0, Math.min(1, 1 - r.rss_feed_failures / activeFeedsCount))
            : null;
        return {
          ...r,
          noise_ratio,
          ingest_health,
          active_feeds: activeFeedsCount,
        };
      };
      const enrichedRecent = recentRoundRows.map((r) => enrichRoundMetrics(r));
      const enrichedReviewRows = reviewRoundRows.map((r) => enrichRoundMetrics(r));
      const last3Noise = enrichedRecent.slice(0, 3).map((r) => r.noise_ratio);
      const risingNoise3 =
        last3Noise.length >= 3 &&
        last3Noise[0] > last3Noise[1] &&
        last3Noise[1] > last3Noise[2];
      const latestEnriched = roundMetricsRow
        ? enrichRoundMetrics({
            round_id: roundMetricsRow.round_id,
            notifications_high: roundMetricsRow.notifications_high,
            notifications_medium: roundMetricsRow.notifications_medium,
            rss_feed_failures: roundMetricsRow.rss_feed_failures,
          })
        : null;
      const recommendations: Array<{
        kind: 'tune_threshold' | 'feed_quality';
        severity: 'info' | 'warn';
        message: string;
        suggested_high_threshold?: number;
      }> = [];
      if (risingNoise3 && effectivePolicy.high_threshold < 0.9) {
        recommendations.push({
          kind: 'tune_threshold',
          severity: 'warn',
          message: 'Noise ratio rose for 3 rounds; consider raising high threshold.',
          suggested_high_threshold: Math.min(0.95, Number((effectivePolicy.high_threshold + 0.05).toFixed(2))),
        });
      }
      if (latestEnriched?.ingest_health != null && latestEnriched.ingest_health < 0.8) {
        recommendations.push({
          kind: 'feed_quality',
          severity: 'warn',
          message: 'Ingest health is below 80%; check failing feeds and rate-limit settings.',
        });
      }
      const recentPolicyChanges = loadNotificationPolicyChangeLogs(db, 10);
      const reviewWindows = recentPolicyChanges.map((change) => {
        const roundsAfter = enrichedReviewRows
          .filter((r) => typeof r.created_at_utc === 'string' && r.created_at_utc >= change.changed_at_utc)
          .slice(0, 5);
        const roundsBefore = enrichedReviewRows
          .filter((r) => typeof r.created_at_utc === 'string' && r.created_at_utc < change.changed_at_utc)
          .slice(0, 3);
        return {
          change_id: change.id,
          changed_at_utc: change.changed_at_utc,
          high_threshold_after: change.high_threshold_after,
          medium_threshold_after: change.medium_threshold_after,
          rounds_after: roundsAfter,
          rounds_before: roundsBefore,
        };
      });

      jsonResponse(res, 200, {
        success: true,
        latest_round_id: latestRoundId,
        normalized_items: normalized.cnt,
        clusters: clusters.cnt,
        decision_signals: signals.cnt,
        knowledge_entries: knowledge.cnt,
        cluster_kind_summary: clusterKindSummary,
        privacy_checks: privacyChecks,
        notification_counts: notificationCounts,
        notification_policy: effectivePolicy,
        signal_extractor: rt.signal_extractor,
        push_pipeline_enabled: rt.push_pipeline_enabled,
        rss_fetch: rt.rss_fetch,
        llm_configured: rt.llm_configured,
        metrics: {
          latest_round: latestEnriched,
          recent_rounds: enrichedRecent,
          recommendations,
        },
        policy_tuning: {
          current: effectivePolicy,
          recent_changes: recentPolicyChanges,
          review_windows: reviewWindows,
        },
      });
      return;
    }

    if (
      (url === '/api/push/status' ||
        url === '/api/push/consent' ||
        url === '/api/push/subscribe' ||
        url === '/api/push/unsubscribe' ||
        url === '/api/push/vapid-public-key' ||
        url === '/api/push/enqueue-test' ||
        url === '/api/push/send') &&
      !isPushPipelineEnabled()
    ) {
      jsonResponse(res, 503, {
        success: false,
        error: 'push_disabled',
        hint: 'Web Push is disabled in this build. Set PIH_PUSH_ENABLED=true to enable push APIs.',
      });
      return;
    }

    if (url === '/api/push/consent' && method === 'GET') {
      const row = db
        .prepare(
          `
          SELECT push_permission_status, consent_timestamp, created_at_utc
          FROM notification_subscriptions
          ORDER BY datetime(created_at_utc) DESC
          LIMIT 1
          `,
        )
        .get() as
        | { push_permission_status: string; consent_timestamp: string | null; created_at_utc: string }
        | undefined;
      jsonResponse(res, 200, {
        success: true,
        has_subscription: Boolean(row),
        push_permission_status: row?.push_permission_status ?? 'unknown',
        consent_timestamp: row?.consent_timestamp ?? null,
        last_subscription_at_utc: row?.created_at_utc ?? null,
      });
      return;
    }

    if (url === '/api/push/status' && method === 'GET') {
      const row = db.prepare('SELECT COUNT(*) AS cnt FROM notification_subscriptions').get() as { cnt: number };
      const vapidConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
      jsonResponse(res, 200, {
        success: true,
        subscription_count: row.cnt,
        vapid_configured: vapidConfigured,
        notification_policy: loadRuntimeNotificationPolicy(db),
      });
      return;
    }

    if (url === '/api/push/subscribe' && method === 'POST') {
      if (!assertPushApiAuth()) return;
      const body = (await readJsonBody(req)) as any;
      const endpoint: string | undefined = body?.endpoint ?? body?.subscription?.endpoint;
      if (!endpoint) {
        jsonResponse(res, 400, { success: false, error: 'missing endpoint' });
        return;
      }

      const subscriptionJson = JSON.stringify(
        body?.subscription ?? {
          endpoint,
          keys: body?.keys,
        }
      );
      const subscriptionJsonStored = maybeEncryptSubscriptionJson(
        subscriptionJson,
        appCfg.pushSubscriptionSecret,
      );

      const allowedPerm = new Set(['granted', 'denied', 'default', 'unknown']);
      const rawPerm = body?.push_permission_status;
      const pushPermissionStatus =
        typeof rawPerm === 'string' && allowedPerm.has(rawPerm) ? rawPerm : 'granted';

      const rawTs = body?.consent_timestamp;
      const consentTimestamp =
        typeof rawTs === 'string' && rawTs.trim() ? rawTs.trim() : new Date().toISOString();

      db.prepare(
        `
        INSERT OR REPLACE INTO notification_subscriptions
          (endpoint, subscription_json, push_permission_status, consent_timestamp)
        VALUES (?, ?, ?, ?)
        `,
      ).run(endpoint, subscriptionJsonStored, pushPermissionStatus, consentTimestamp);

      jsonResponse(res, 200, { success: true, push_permission_status: pushPermissionStatus });
      return;
    }

    if (url === '/api/push/unsubscribe' && method === 'POST') {
      if (!assertPushApiAuth()) return;
      const body = (await readJsonBody(req)) as any;
      const endpoint: string | undefined = body?.endpoint ?? body?.subscription?.endpoint;
      if (!endpoint) {
        jsonResponse(res, 400, { success: false, error: 'missing endpoint' });
        return;
      }

      const info = db.prepare('DELETE FROM notification_subscriptions WHERE endpoint = ?').run(endpoint);
      const endpointSha256 = sha256Hex(endpoint);
      db.prepare(
        `
        INSERT INTO push_unsubscribe_log (endpoint_sha256, deleted_rows)
        VALUES (?, ?)
        `,
      ).run(endpointSha256, info.changes);

      jsonResponse(res, 200, { success: true, deleted: info.changes, unsubscribe_logged: true });
      return;
    }

    if (url === '/api/push/vapid-public-key' && method === 'GET') {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) {
        jsonResponse(res, 200, { success: false, error: 'missing_vapid_public_key', publicKey: null });
        return;
      }
      jsonResponse(res, 200, { success: true, publicKey });
      return;
    }

    if (url === '/api/push/enqueue-test' && method === 'POST') {
      if (!assertPushApiAuth()) return;
      const body = (await readJsonBody(req)) as any;
      const reminder_level = body?.reminder_level === 'medium' ? 'medium' : 'high';
      const event_key = `manual_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const signal_fingerprint = `manual_fp_${event_key}`;
      const payload = buildPushPayload({
        event_key,
        reminder_level,
        title: `Key change (${reminder_level})`,
        short_summary_source: 'Manual test notification (end-to-end)',
      });

      db.prepare(
        `
        INSERT INTO notification_event_log
          (user_id, event_key, reminder_level, signal_fingerprint, payload_json, status)
        VALUES
          (?, ?, ?, ?, ?, 'queued')
        `,
      ).run('local-user', event_key, reminder_level, signal_fingerprint, JSON.stringify(payload));

      jsonResponse(res, 200, { success: true, event_key, reminder_level });
      return;
    }

    if (url === '/api/push/send' && method === 'POST') {
      if (!assertPushApiAuth()) return;
      const body = (await readJsonBody(req)) as any;
      const mode = (body?.mode === 'real' ? 'real' : 'simulate') as 'simulate' | 'real';
      const limitRaw = body?.limit;
      const limit = typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? Math.max(1, Math.floor(limitRaw)) : 50;
      const nowUtcIso = new Date().toISOString();

      try {
        const result = await dispatchQueuedNotifications(db, {
          userId: 'local-user',
          mode,
          limit,
          nowUtcIso,
        });

        if (!result.success) {
          jsonResponse(res, 501, { success: false, error: 'real mode not implemented yet' });
          return;
        }

        jsonResponse(res, 200, result);
        return;
      } catch (err: any) {
        jsonResponse(res, 500, { success: false, error: String(err?.message ?? err) });
        return;
      }
    }

    // Not an API route.
    res.statusCode = 404;
    res.end();
  };
}

