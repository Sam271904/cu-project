import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import type { HnStory, HnStoryType, HnAdapterConfig } from './types';

const HN_FIREBASE_BASE = 'https://hacker-news.firebaseio.com/v0';

const STORY_TYPE_LISTS: Record<HnStoryType, string> = {
  top: 'topstories',
  new: 'newstories',
  best: 'beststories',
};

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;
    const req = client.request(url, { headers: { 'User-Agent': 'e-cu-hn-adapter' } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T);
        } catch (e) {
          reject(new Error(`HN API parse error: ${(e as Error).message}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

type FirebaseItem = {
  id: number;
  title?: string;
  url?: string;
  by?: string;
  score?: number;
  descendants?: number;
  type?: string;
  dead?: boolean;
  deleted?: boolean;
};

async function fetchStoryItem(hnId: number): Promise<FirebaseItem | null> {
  try {
    return await fetchJson<FirebaseItem>(`${HN_FIREBASE_BASE}/item/${hnId}.json`);
  } catch {
    return null;
  }
}

export type FetchHnResult =
  | { ok: true; stories: HnStory[] }
  | { ok: false; reason: 'rate_limit' | 'network' | 'unknown'; cached?: HnStory[] };

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let lastSuccessfulFetch: { stories: HnStory[]; timestamp: number } | null = null;

export async function fetchHnStories(
  cfg: HnAdapterConfig,
  prevPositions: Map<number, number>, // hn_id → previous position from hn_position_tracking
  nowUtcIso: string,
): Promise<FetchHnResult> {
  if (!cfg.enabled) return { ok: false, reason: 'unknown' };

  const allStories: HnStory[] = [];

  for (const storyType of cfg.storyTypes) {
    let ids: number[];
    try {
      ids = await fetchJson<number[]>(`${HN_FIREBASE_BASE}/${STORY_TYPE_LISTS[storyType]}.json`);
    } catch (e) {
      if (lastSuccessfulFetch && Date.now() - lastSuccessfulFetch.timestamp < CACHE_TTL_MS) {
        return { ok: true, stories: lastSuccessfulFetch.stories };
      }
      return { ok: false, reason: 'network' };
    }

    const limitedIds = ids.slice(0, cfg.fetchLimit);

    // Fetch story items in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < limitedIds.length; i += batchSize) {
      const batch = limitedIds.slice(i, i + batchSize);
      const items = await Promise.all(batch.map((id) => fetchStoryItem(id)));

      for (const item of items) {
        if (!item || item.deleted || item.dead || !item.title) continue;
        const position = limitedIds.indexOf(item.id) + 1;
        const prev = prevPositions.get(item.id) ?? null;
        const velocity = prev !== null ? prev - position : null;

        allStories.push({
          hn_id: item.id,
          title: item.title,
          url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
          hn_url: `https://news.ycombinator.com/item?id=${item.id}`,
          author: item.by ?? 'unknown',
          position,
          score: item.score ?? 0,
          comment_count: item.descendants ?? 0,
          story_type: storyType,
          fetched_at: nowUtcIso,
          prev_position: prev,
          velocity,
        });
      }
    }
  }

  lastSuccessfulFetch = { stories: allStories, timestamp: Date.now() };
  return { ok: true, stories: allStories };
}

export function loadHnAdapterConfig(env: NodeJS.ProcessEnv): HnAdapterConfig {
  const enabled = String(env.PIH_HN_ENABLED ?? 'true').toLowerCase() !== 'false';
  const rawLimit = Number(env.PIH_HN_FETCH_LIMIT ?? '30');
  const fetchLimit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 30));
  const fallbackToRss = String(env.PIH_HN_FALLBACK_RSS ?? 'true').toLowerCase() !== 'false';

  const rawTypes = String(env.PIH_HN_STORY_TYPES ?? 'top,new');
  const storyTypes = rawTypes
    .split(',')
    .map((s) => s.trim() as HnStoryType)
    .filter((s): s is HnStoryType => ['top', 'new', 'best'].includes(s));

  return {
    enabled,
    fetchLimit,
    storyTypes: storyTypes.length > 0 ? storyTypes : ['top', 'new'],
    fallbackToRss,
  };
}
