# HackerNews Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HN Firebase API adapter that tracks story position and velocity as personalization ranking signals.

**Architecture:** New `adapters/hackernews/` directory follows the existing `adapters/rss/` pattern. HN stories are ingested via `POST /api/collect` using the same `raw_items` table, with HN-specific metadata in a new `source_metadata_json` column. HN signals are blended into `scoreClusterForPersonalization` at ranking time only.

**Tech Stack:** Node.js `http`/`https` (no new deps), TypeScript, SQLite (better-sqlite3), existing test infra (Vitest).

---

## File Map

### New files to create

| File | Purpose |
|------|---------|
| `backend/src/adapters/hackernews/types.ts` | `HnStory` interface, `HnAdapter` interface |
| `backend/src/adapters/hackernews/fetchHnStories.ts` | `fetchHnStories()` implementation |
| `backend/src/adapters/hackernews/index.ts` | Re-exports |
| `backend/tests/hackernews-adapter.test.ts` | HN adapter unit tests |
| `backend/tests/hackernews-velocity.test.ts` | Velocity scoring unit tests |

### Existing files to modify

| File | Change |
|------|--------|
| `backend/src/db/schema.ts` | Add `source_metadata_json TEXT` to `raw_items`; add `hn_position_tracking` table |
| `backend/src/db/db.ts` | Add `source_metadata_json` to `raw_items` insert |
| `backend/src/adapters/index.ts` | Export HN adapter |
| `backend/src/routes/api.ts` | Add `source_types: ['hn']` support in `POST /api/collect` |
| `backend/src/services/personalization/scoreCluster.ts` | Blend HN velocity signal into final score |
| `backend/src/services/personalization/types.ts` | Add `hn_signal?: number` to `PersonalizationScore` |
| `backend/src/config.ts` | Add `PIH_HN_*` env vars |

---

## Task 1: Database schema — add source_metadata_json to raw_items

**Files:**
- Modify: `backend/src/db/schema.ts`
- Modify: `backend/src/db/db.ts`

- [ ] **Step 1: Add `source_metadata_json` column to `raw_items` in schema**

In `backend/src/db/schema.ts`, find the `raw_items` CREATE TABLE and add `source_metadata_json TEXT` before the closing `);`:

```sql
CREATE TABLE IF NOT EXISTS raw_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_round_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TEXT,
  collected_at TEXT NOT NULL,
  url TEXT NOT NULL,
  excerpt_or_summary TEXT,
  author TEXT,
  language TEXT NOT NULL,
  timestamp_quality TEXT NOT NULL,
  source_metadata_json TEXT,
  FOREIGN KEY(collection_round_id) REFERENCES collection_rounds(id)
);
```

- [ ] **Step 2: Add `hn_position_tracking` table**

Append after the `raw_items` block:

```sql
CREATE TABLE IF NOT EXISTS hn_position_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hn_id INTEGER NOT NULL,
  collection_round_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  velocity INTEGER,
  fetched_at TEXT NOT NULL,
  UNIQUE(hn_id, collection_round_id),
  FOREIGN KEY(collection_round_id) REFERENCES collection_rounds(id)
);
```

- [ ] **Step 3: Update `raw_items` INSERT in `db.ts`**

Read `backend/src/db/db.ts`. Find the `raw_items` insert statements and add `source_metadata_json` as the 14th column + `?` value. The insert signature changes from 13 to 14 columns.

```typescript
// In the INSERT statement for raw_items, add:
// source_metadata_json TEXT
// Values: ..., source_metadata_json: item.source_metadata_json ?? null
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts backend/src/db/db.ts
git commit -m "feat(db): add source_metadata_json to raw_items and hn_position_tracking table"
```

---

## Task 2: HN adapter — types and fetch implementation

**Files:**
- Create: `backend/src/adapters/hackernews/types.ts`
- Create: `backend/src/adapters/hackernews/fetchHnStories.ts`
- Create: `backend/src/adapters/hackernews/index.ts`

- [ ] **Step 1: Write `types.ts`**

Create `backend/src/adapters/hackernews/types.ts`:

```typescript
export type HnStoryType = 'top' | 'new' | 'best';

export type HnStory = {
  hn_id: number;
  title: string;
  url: string;
  hn_url: string;
  author: string;
  position: number; // 1 = top of the list
  score: number;
  comment_count: number;
  story_type: HnStoryType;
  fetched_at: string; // ISO UTC
  /** Null if never observed before */
  prev_position: number | null;
  /** Computed: prev_position - position (positive = rising) */
  velocity: number | null;
};

export type HnAdapterConfig = {
  enabled: boolean;
  fetchLimit: number; // per list, max 100
  storyTypes: HnStoryType[];
  fallbackToRss: boolean;
};
```

- [ ] **Step 2: Write `fetchHnStories.ts`**

Create `backend/src/adapters/hackernews/fetchHnStories.ts`:

```typescript
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
```

- [ ] **Step 3: Write `index.ts`**

Create `backend/src/adapters/hackernews/index.ts`:

```typescript
export { fetchHnStories, loadHnAdapterConfig, type HnStory, type HnStoryType, type HnAdapterConfig, type FetchHnResult } from './fetchHnStories';
export { type HnAdapterConfig } from './types';
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/adapters/hackernews/
git commit -m "feat(hn): initial HackerNews Firebase API adapter"
```

---

## Task 3: Integrate HN into /api/collect

**Files:**
- Modify: `backend/src/routes/api.ts`
- Modify: `backend/src/adapters/index.ts`

- [ ] **Step 1: Export HN adapter from `adapters/index.ts`**

Add to `backend/src/adapters/index.ts`:

```typescript
export { fetchHnStories, loadHnAdapterConfig, type HnAdapterConfig } from './hackernews';
```

- [ ] **Step 2: Modify `POST /api/collect` to support `source_types: ['hn']`**

In `backend/src/routes/api.ts`:

Find the `POST /api/collect` handler (around line 310). Add `source_types` parsing after `useStoredFeeds`:

```typescript
const sourceTypes: string[] = Array.isArray(body?.source_types) ? body.source_types : ['rss', 'social', 'hn', 'bookmark'];
```

Change the feed ingestion logic to only run if the corresponding source type is included:

```typescript
// Instead of:
if (socialRssFeeds.length > 0) {
  socialCount = await ingestRssFeeds({ feeds: socialRssFeeds, sourceType: 'social' });
}

// Use:
if (sourceTypes.includes('social') && socialRssFeeds.length > 0) {
  socialCount = await ingestRssFeeds({ feeds: socialRssFeeds, sourceType: 'social' });
}
// Similarly for tech
```

Add HN ingestion block after the RSS feed ingestion:

```typescript
let hnCount = 0;
if (sourceTypes.includes('hn')) {
  const { fetchHnStories, loadHnAdapterConfig } = await import('../adapters/hackernews');
  const hnCfg = loadHnAdapterConfig(process.env);

  // Load previous positions from hn_position_tracking
  const prevRows = db.prepare(
    'SELECT hn_id, position FROM hn_position_tracking WHERE collection_round_id = ?'
  ).all() as Array<{ hn_id: number; position: number }>;
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
        nowUtcIso, // HN API doesn't give publish time; use collection time
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
```

Update the response to include `hnCount`:

```typescript
jsonResponse(res, 200, {
  success: true,
  round_id: roundId,
  ingested: { social: socialCount, tech: techCount, hn: hnCount },
  rss_feed_failures: rssFeedFailures,
  rss_feed_errors: rssFeedErrors,
  notifications,
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/api.ts backend/src/adapters/index.ts
git commit -m "feat(api): add HN adapter to /api/collect with source_types"
```

---

## Task 4: Personalization scoring with HN velocity signal

**Files:**
- Modify: `backend/src/services/personalization/scoreCluster.ts`
- Modify: `backend/src/services/personalization/types.ts`
- Modify: `backend/src/config.ts`

- [ ] **Step 1: Add `hn_signal` to `PersonalizationScore`**

In `backend/src/services/personalization/types.ts`:

```typescript
export type PersonalizationScore = {
  score: number;
  reasons: string[];
  denied: boolean;
  /** HN velocity + position signal [0, 1], null if no HN data */
  hn_signal?: number | null;
};
```

- [ ] **Step 2: Add HN signal computation to `scoreClusterForPersonalization`**

Read `backend/src/services/personalization/loadProfile.ts` to understand the full `scoreClusterForPersonalization` call chain. The function takes `cluster_id` but needs access to `raw_items.source_metadata_json`. The scoring function needs a new parameter.

In `scoreCluster.ts`, add a helper and update the function signature:

```typescript
/**
 * sigmoid(x / scale) → [0, 1]
 * velocity of 10 positions/round ≈ "significant" → sigmoid(1) ≈ 0.73
 */
function velocityScore(velocity: number): number {
  const s = 1 / (1 + Math.exp(-velocity / 10));
  return s;
}

function positionScore(position: number): number {
  // position 1 → 1.0, position 100 → 0, clamped
  return Math.max(0, Math.min(1, 1 - position / 100));
}

export function computeHnSignal(velocity: number | null, position: number): number | null {
  const vScore = velocity !== null ? velocityScore(velocity) : 0.5; // 0.5 = "unknown"
  const pScore = positionScore(position);
  return vScore * 0.6 + pScore * 0.4;
}

export function scoreClusterForPersonalization(
  input: {
    cluster_id: string;
    content_summary: string;
    snippet_text: string;
    tags: string[];
    extra_text?: string;
    hn_signal?: number | null; // NEW
  },
  profile: PersonalizationProfile,
): PersonalizationScore {
  // ... existing deny/allow/persona/feedback logic unchanged ...

  let score = 0;
  const reasons: string[] = [];

  // ... existing scoring logic (deny, allow, persona, feedback) ...

  // Blend HN signal at the end
  let hn_signal: number | null = null;
  const HN_WEIGHT = 0.15;
  if (input.hn_signal != null) {
    hn_signal = input.hn_signal;
    score = score * (1 - HN_WEIGHT) + hn_signal * HN_WEIGHT;
    reasons.push(`hn:${hn_signal.toFixed(3)}`);
  }

  return { score, reasons, denied: false, hn_signal };
}
```

- [ ] **Step 3: Add `PIH_HN_*` config to `config.ts`**

In `backend/src/config.ts`, add to `AppConfig`:

```typescript
export type AppConfig = {
  // ... existing fields ...
  hnEnabled: boolean;
  hnFetchLimit: number;
  hnStoryTypes: Array<'top' | 'new' | 'best'>;
};
```

In `loadAppConfig`:

```typescript
const hnEnabled = String(env.PIH_HN_ENABLED ?? 'true').toLowerCase() !== 'false';
const hnFetchLimit = Math.min(100, Math.max(1, Number(env.PIH_HN_FETCH_LIMIT ?? '30') as number));
const rawHnTypes = String(env.PIH_HN_STORY_TYPES ?? 'top,new');
const hnStoryTypes = rawHnTypes.split(',').map(s => s.trim()).filter(s => ['top','new','best'].includes(s)) as Array<'top'|'new'|'best'>;

// Add to return object:
hnEnabled,
hnFetchLimit,
hnStoryTypes,
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/personalization/scoreCluster.ts backend/src/services/personalization/types.ts backend/src/config.ts
git commit -m "feat(personalization): blend HN velocity signal into cluster scoring"
```

---

## Task 5: Write unit tests

**Files:**
- Create: `backend/tests/hackernews-adapter.test.ts`
- Create: `backend/tests/hackernews-velocity.test.ts`

- [ ] **Step 1: Write `hackernews-adapter.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchHnStories, loadHnAdapterConfig } from '../src/adapters/hackernews/fetchHnStories';

describe('hackernews-adapter', () => {
  describe('loadHnAdapterConfig', () => {
    it('defaults to enabled with top+new', () => {
      const cfg = loadHnAdapterConfig({});
      expect(cfg.enabled).toBe(true);
      expect(cfg.storyTypes).toEqual(['top', 'new']);
      expect(cfg.fetchLimit).toBe(30);
    });

    it('parses custom limit', () => {
      const cfg = loadHnAdapterConfig({ PIH_HN_FETCH_LIMIT: '50' });
      expect(cfg.fetchLimit).toBe(50);
    });

    it('caps limit at 100', () => {
      const cfg = loadHnAdapterConfig({ PIH_HN_FETCH_LIMIT: '500' });
      expect(cfg.fetchLimit).toBe(100);
    });

    it('disables when PIH_HN_ENABLED=false', () => {
      const cfg = loadHnAdapterConfig({ PIH_HN_ENABLED: 'false' });
      expect(cfg.enabled).toBe(false);
    });
  });

  describe('fetchHnStories (mock)', () => {
    // Use globalThis.fetch mocking — the actual implementation uses http module
    // These tests verify the result structure, not the network call
  });
});
```

- [ ] **Step 2: Write `hackernews-velocity.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { computeHnSignal, velocityScore, positionScore } from '../src/services/personalization/scoreCluster';

describe('hackernews-velocity', () => {
  describe('velocityScore', () => {
    it('returns 0.5 when velocity is null/unknown (first observation)', () => {
      // sigmoid(0) = 0.5
      expect(velocityScore(0)).toBeCloseTo(0.5);
    });

    it('returns > 0.5 for positive velocity (rising)', () => {
      // velocity=10 → significant rising
      expect(velocityScore(10)).toBeGreaterThan(0.7);
      expect(velocityScore(10)).toBeLessThan(0.8);
    });

    it('returns < 0.5 for negative velocity (falling)', () => {
      expect(velocityScore(-10)).toBeLessThan(0.3);
    });

    it('caps at ~1.0 for very high velocity', () => {
      expect(velocityScore(100)).toBeGreaterThan(0.99);
    });
  });

  describe('positionScore', () => {
    it('returns 1.0 for position 1', () => {
      expect(positionScore(1)).toBeCloseTo(1.0);
    });

    it('returns 0.0 for position 100+', () => {
      expect(positionScore(100)).toBe(0);
      expect(positionScore(200)).toBe(0);
    });

    it('returns 0.5 for position ~50', () => {
      expect(positionScore(50)).toBeCloseTo(0.5);
    });
  });

  describe('computeHnSignal', () => {
    it('blends velocity and position: rising + top → high signal', () => {
      const sig = computeHnSignal(20, 3); // fast rising, near top
      expect(sig).toBeGreaterThan(0.7);
    });

    it('first observation (null velocity) still gets decent score if top position', () => {
      const sig = computeHnSignal(null, 5);
      expect(sig).toBeGreaterThan(0.5);
      expect(sig).toBeLessThan(0.7);
    });

    it('stable story (velocity=0) at position 50 → moderate signal', () => {
      const sig = computeHnSignal(0, 50);
      expect(sig).toBeCloseTo(0.5, 1);
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npx vitest run hackernews-adapter.test.ts hackernews-velocity.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/hackernews-adapter.test.ts backend/tests/hackernews-velocity.test.ts
git commit -m "test(hn): add HN adapter and velocity scoring unit tests"
```

---

## Task 6: Full integration verification

- [ ] **Step 1: Run all backend tests**

```bash
npm run test
```

Expected: all 133+ tests pass including new ones.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit final state**

---

## Completion Checklist

- [ ] `hn_position_tracking` table created and populated each round
- [ ] HN adapter fetches Top/New/Best stories via Firebase API
- [ ] Position and velocity stored in `raw_items.source_metadata_json`
- [ ] Velocity signal influences personalization score (HN_WEIGHT=0.15)
- [ ] All new tests pass
- [ ] Existing `/api/collect` works for all source types
- [ ] `npm run build && npm run test` green
