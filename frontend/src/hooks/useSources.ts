import React from 'react';

import type { FeedHealthRow, FeedRow, FeedType, UiLang } from '../types/ui';
import { getCached, invalidateCache } from '../utils/requestCache';

type UseSourcesDeps = {
  lang: UiLang;
  onDataLanguageUpdated: (lang: UiLang) => void;
  onAfterCollectOrImport: () => Promise<void>;
};

export function useSources(deps: UseSourcesDeps) {
  const { lang, onDataLanguageUpdated, onAfterCollectOrImport } = deps;

  const [feeds, setFeeds] = React.useState<FeedRow[]>([]);
  const [feedsLoading, setFeedsLoading] = React.useState(false);
  const [feedsError, setFeedsError] = React.useState<string | null>(null);
  const [feedHealth, setFeedHealth] = React.useState<FeedHealthRow[]>([]);
  const [newFeedUrl, setNewFeedUrl] = React.useState('');
  const [newFeedType, setNewFeedType] = React.useState<FeedType>('social');
  const [newFeedName, setNewFeedName] = React.useState('');
  const [collectLoading, setCollectLoading] = React.useState(false);
  const [collectError, setCollectError] = React.useState<string | null>(null);
  const [collectInfo, setCollectInfo] = React.useState<string | null>(null);
  const [bookmarkJson, setBookmarkJson] = React.useState('');
  const [bookmarkLoading, setBookmarkLoading] = React.useState(false);
  const [bookmarkError, setBookmarkError] = React.useState<string | null>(null);
  const [bookmarkInfo, setBookmarkInfo] = React.useState<string | null>(null);

  const FEEDS_CACHE_KEY = 'api:/feeds';
  const FEEDS_HEALTH_CACHE_KEY = 'api:/feeds/health';
  const FEEDS_TTL_MS = 10_000;

  async function loadFeeds(force = false) {
    setFeedsLoading(true);
    setFeedsError(null);
    try {
      const rows = await getCached<FeedRow[]>(
        FEEDS_CACHE_KEY,
        FEEDS_TTL_MS,
        async () => {
          const res = await fetch('/api/feeds');
          const json = (await res.json()) as { success?: boolean; feeds?: FeedRow[] };
          if (!res.ok || !json?.success) {
            throw new Error(`feeds_failed_http_${res.status}`);
          }
          return Array.isArray(json.feeds) ? json.feeds : [];
        },
        { force },
      );
      setFeeds(rows);
      const healthRows = await getCached<FeedHealthRow[]>(
        FEEDS_HEALTH_CACHE_KEY,
        FEEDS_TTL_MS,
        async () => {
          const res = await fetch('/api/feeds/health');
          const json = (await res.json()) as { success?: boolean; feeds?: FeedHealthRow[] };
          if (!res.ok || !json?.success) {
            throw new Error(`feeds_health_failed_http_${res.status}`);
          }
          return Array.isArray(json.feeds) ? json.feeds : [];
        },
        { force },
      );
      setFeedHealth(healthRows);
    } catch (e: any) {
      setFeedsError(String(e?.message ?? e));
      setFeeds([]);
      setFeedHealth([]);
    } finally {
      setFeedsLoading(false);
    }
  }

  async function addFeedRow() {
    const feed_url = newFeedUrl.trim();
    if (!feed_url) return;
    setFeedsLoading(true);
    setFeedsError(null);
    try {
      const body: { source_type: FeedType; feed_url: string; source_name?: string } = {
        source_type: newFeedType,
        feed_url,
      };
      const name = newFeedName.trim();
      if (name) body.source_name = name;

      const res = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (res.status === 409 && json?.error === 'feed_url_duplicate') {
        setFeedsError(lang === 'zh' ? '该 URL 已存在' : 'Feed URL already exists');
        return;
      }
      if (!res.ok || !json?.success) {
        setFeedsError(`add_feed_failed_http_${res.status}`);
        return;
      }
      invalidateCache(FEEDS_CACHE_KEY);
      invalidateCache(FEEDS_HEALTH_CACHE_KEY);
      setNewFeedUrl('');
      setNewFeedName('');
      await loadFeeds(true);
    } catch (e: any) {
      setFeedsError(String(e?.message ?? e));
    } finally {
      setFeedsLoading(false);
    }
  }

  async function patchFeedMute(id: number, muteDays: number) {
    setFeedsLoading(true);
    setFeedsError(null);
    try {
      const res = await fetch('/api/feeds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ id, mute_days: muteDays }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (res.status === 404 && json?.error === 'feed_not_found') {
        setFeedsError(lang === 'zh' ? '信源不存在' : 'Feed not found');
        return;
      }
      if (res.status === 400 && json?.error === 'invalid_mute_days') {
        setFeedsError(lang === 'zh' ? '静音天数无效（1–365 或 0 解除）' : 'Invalid mute_days (1–365 or 0 to clear)');
        return;
      }
      if (!res.ok || !json?.success) {
        setFeedsError(`mute_feed_failed_http_${res.status}`);
        return;
      }
      invalidateCache([FEEDS_CACHE_KEY, FEEDS_HEALTH_CACHE_KEY, 'api:/demo/status']);
      await loadFeeds(true);
    } catch (e: any) {
      setFeedsError(String(e?.message ?? e));
    } finally {
      setFeedsLoading(false);
    }
  }

  async function deleteFeedRow(id: number) {
    setFeedsLoading(true);
    setFeedsError(null);
    try {
      const res = await fetch(`/api/feeds?id=${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success?: boolean };
      if (!res.ok || !json?.success) {
        setFeedsError(`delete_feed_failed_http_${res.status}`);
        return;
      }
      invalidateCache(FEEDS_CACHE_KEY);
      invalidateCache(FEEDS_HEALTH_CACHE_KEY);
      await loadFeeds(true);
    } catch (e: any) {
      setFeedsError(String(e?.message ?? e));
    } finally {
      setFeedsLoading(false);
    }
  }

  async function importBookmarksFromJson() {
    setBookmarkLoading(true);
    setBookmarkError(null);
    setBookmarkInfo(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(bookmarkJson || '[]');
      } catch {
        setBookmarkError(lang === 'zh' ? 'JSON 格式无效' : 'Invalid JSON');
        return;
      }
      const items = Array.isArray(parsed) ? parsed : Array.isArray((parsed as any)?.items) ? (parsed as any).items : null;
      if (!items) {
        setBookmarkError(lang === 'zh' ? '需要 JSON 数组或含 items 数组的对象' : 'Expected a JSON array or an object with an items array');
        return;
      }
      const res = await fetch('/api/import/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ items, lang }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        inserted?: number;
        skipped?: number;
        round_id?: number;
      };
      if (res.status === 400 && json?.error === 'no_valid_bookmarks') {
        setBookmarkError(lang === 'zh' ? '没有有效的 http(s) 链接' : 'No valid http(s) URLs');
        return;
      }
      if (!res.ok || !json?.success) {
        setBookmarkError(`bookmark_import_failed_${res.status}`);
        return;
      }
      setBookmarkInfo(
        lang === 'zh'
          ? `已导入 ${json.inserted} 条（跳过 ${json.skipped ?? 0}），轮次 ${json.round_id}`
          : `Imported ${json.inserted} (skipped ${json.skipped ?? 0}), round ${json.round_id}`,
      );
      onDataLanguageUpdated(lang);
      invalidateCache(['api:/homepage', 'api:/demo/status']);
      invalidateCache(FEEDS_HEALTH_CACHE_KEY);
      await onAfterCollectOrImport();
    } catch (e: any) {
      setBookmarkError(String(e?.message ?? e));
    } finally {
      setBookmarkLoading(false);
    }
  }

  async function collectFromStoredFeeds() {
    setCollectLoading(true);
    setCollectError(null);
    setCollectInfo(null);
    try {
      const res = await fetch('/api/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ useStoredFeeds: true, lang }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; round_id?: number; ingested?: { social: number; tech: number } };
      if (res.status === 400 && json?.error === 'no_feeds_configured') {
        setCollectError(lang === 'zh' ? '未配置任何信源' : 'No feeds configured');
        return;
      }
      if (!res.ok || !json?.success) {
        setCollectError(`collect_failed_http_${res.status}`);
        return;
      }
      setCollectInfo(
        lang === 'zh'
          ? `完成：轮次 ${json.round_id}，社媒 ${json.ingested?.social ?? 0}，技术 ${json.ingested?.tech ?? 0}`
          : `Done: round ${json.round_id}, social ${json.ingested?.social ?? 0}, tech ${json.ingested?.tech ?? 0}`,
      );
      onDataLanguageUpdated(lang);
      invalidateCache(['api:/homepage', 'api:/demo/status']);
      await onAfterCollectOrImport();
    } catch (e: any) {
      setCollectError(String(e?.message ?? e));
    } finally {
      setCollectLoading(false);
    }
  }

  return {
    feeds,
    feedsLoading,
    feedsError,
    feedHealth,
    newFeedUrl,
    newFeedType,
    newFeedName,
    collectLoading,
    collectError,
    collectInfo,
    bookmarkJson,
    bookmarkLoading,
    bookmarkError,
    bookmarkInfo,
    setNewFeedUrl,
    setNewFeedType,
    setNewFeedName,
    setBookmarkJson,
    loadFeeds,
    addFeedRow,
    deleteFeedRow,
    patchFeedMute,
    importBookmarksFromJson,
    collectFromStoredFeeds,
  };
}
