# HackerNews API Adapter — v2 Milestone D1 Design

> **Status:** Approved for implementation
> **Parent:** e-cu v2 roadmap (D → B → A sequence)
> **Date:** 2026-03-27

## Summary

Add a first-class Hacker News (HN) adapter using the **HN Firebase API** (`hacker-news.firebaseio.com`) to track real-time ranking position and velocity as personalization signals. HN data influences homepage ranking but does not trigger standalone push notifications.

## Motivation

The current HN integration uses RSS (via `hnrss.org`), which only tells us "this story exists." The HN Firebase API reveals **how a story is trending** — its position in Top/New/Best lists and how fast it's moving. Position velocity is a strong signal for content importance that the RSS adapter cannot provide.

**Goals:**
- Track HN story position and velocity as scoring signals
- Maintain adapter pattern consistency with existing RSS/social adapters
- Influence personalization ranking without adding push notification noise

**Non-goals:**
- HN stories do not directly trigger standalone push notifications
- HN comments are not parsed (API doesn't provide stable comment structure for MVP)
- No real-time streaming — polling-based with configurable intervals

## Architecture

```
HN Firebase API (hacker-news.firebaseio.com)
         ↓
  HN Adapter (backend/src/adapters/hackernews/)
         ↓
   raw_items (source_type='hn')
         ↓
   cluster_timeline_state + personalization scoring
         ↓
   Homepage ranking (not push notifications)
```

## Data Model

### raw_items source_metadata_json (source_type='hn')

```json
{
  "hn_id": 12345678,
  "hn_url": "https://news.ycombinator.com/item?id=12345678",
  "position": 5,
  "prev_position": 42,
  "velocity": 37,
  "score": 412,
  "comment_count": 89,
  "author": "username",
  "story_type": "top",
  "fetched_at": "2026-03-27T10:00:00Z"
}
```

**Field semantics:**
- `position`: Current rank in selected HN list (1 = top)
- `prev_position`: Position from previous collection round (null if first observation)
- `velocity`: `prev_position - position` (positive = rising, negative = falling, null = first observation)
- `story_type`: One of `top`, `new`, `best`

### New table: hn_position_tracking

```sql
CREATE TABLE IF NOT EXISTS hn_position_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hn_id INTEGER NOT NULL,
  collection_round_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  velocity INTEGER,
  fetched_at TEXT NOT NULL,
  UNIQUE(hn_id, collection_round_id)
);
```

Purpose: Long-running velocity analysis across collection rounds, not required for MVP scoring but enables future trend analysis.

**Note:** `collection_round_id` references `collection_rounds.id` (defined in `backend/src/db/schema.ts`). HN position tracking entries are written each round alongside the main `raw_items` ingest.

## Adapter Interface

### File: `backend/src/adapters/hackernews/fetchHnStories.ts`

```typescript
interface HnStory {
  hn_id: number
  title: string
  url: string
  hn_url: string
  author: string
  position: number
  score: number
  comment_count: number
  story_type: 'top' | 'new' | 'best'
  fetched_at: string // ISO UTC
}

interface HnAdapter {
  fetchTopStories(limit?: number): Promise<HnStory[]>
  fetchNewStories(limit?: number): Promise<HnStory[]>
  fetchBestStories(limit?: number): Promise<HnStory[]>
}
```

**Limits:** Default `limit=30` per list, max `limit=100` (HN API constraint).

### HN API endpoint

```
GET https://hacker-news.firebaseio.com/v0/{topstories,newstories,beststories}.json
GET https://hacker-news.firebaseio.com/v0/item/{id}.json
```

1. Fetch story ID list from `topstories.json` / `newstories.json` / `beststories.json`
2. Fetch individual story items in batch (up to `limit` concurrent)
3. Assign `position` based on array index + 1

### Error handling

| Scenario | Behavior |
|----------|----------|
| HN API rate limit | Cache last successful response 15min, return cache |
| HN API unreachable | Log `source_metadata.fetch_error=network`, skip HN in this round |
| Per-list failure (e.g., `topstories` fails but `newstories` succeeds) | Continue with successful lists; failed lists skipped for that round only |
| Individual story fetch fails | Skip that story, continue with others |
| Invalid story data | Log and skip, do not block other stories |

### Fallback

If HN API fails 3 consecutive rounds, fall back to `hnrss.org` RSS for the next round only (not permanent downgrade).

## Velocity Signal in Personalization

### Calculation

```typescript
// velocity_score: sigmoid(velocity / 10) → [0, 1], higher = faster rising
// position_score: 1 - (position / 100), clamped to [0, 1], higher = closer to top
// hn_signal = velocity_score * 0.6 + position_score * 0.4

const HN_WEIGHT = 0.15 // portion of final score influenced by HN signals
const final_score = cluster_base_score * (1 - HN_WEIGHT) + hn_signal * HN_WEIGHT
```

### Integration point

`backend/src/services/personalization/scoreCluster.ts` reads `raw_items.source_metadata_json` for `source_type='hn'`, computes `hn_signal`, and blends with existing keyword/persona/feedback scores **at the final ranking stage** — **not** into `evidence_novelty`, `conclusion_delta`, or `conflict_delta`. HN velocity is an orthogonal relevance signal (how much the HN community cares), separate from the event-change signals computed by the notification policy.

The sigmoid divisor of `10` means a story rising ~10 positions per round is considered "significant velocity" (sigmoid(1) ≈ 0.73). This is tuned to filter out normal榜单 fluctuation while catching genuine viral moments.

### Notification impact

HN velocity signals affect **homepage ranking only**. They do not independently trigger `high` notification levels. A cluster still needs to pass the `significant_change_score` threshold via `evidence_novelty + conclusion_delta + conflict_delta`.

## API Endpoints

### No new endpoints

Existing `/api/collect` is extended to accept `source_types` including `'hn'`:

```typescript
// POST /api/collect
{
  useStoredFeeds?: boolean  // default false
  source_types?: ('rss' | 'social' | 'hn' | 'bookmark')[]  // default all
}
```

When `source_types` includes `'hn'`, HN adapter is invoked after stored RSS feeds.

## Configuration

```bash
PIH_HN_ENABLED=true           # Enable/disable HN adapter (default: true)
PIH_HN_FETCH_LIMIT=30        # Stories per HN list (default: 30, max: 100)
PIH_HN_STORY_TYPES=top,new    # Comma-separated lists to fetch (default: top,new)
PIH_HN_FALLBACK_RSS=true      # Use hnrss.org RSS if API fails (default: true)
```

## Testing

### Unit tests: `backend/tests/hackernews-adapter.test.ts`

- Parse HN API item response correctly
- Assign correct `position` based on array index
- Handle missing/null fields in HN item (deleted, dead stories)
- Velocity calculation (first observation, position rise, position fall)
- Sigmoid velocity scoring boundary cases

### Unit tests: `backend/tests/hackernews-velocity.test.ts`

- `velocity_score` when `prev_position` is null (first observation)
- `velocity_score` when velocity is 0 (stable)
- `velocity_score` when velocity is very high (capped by sigmoid)
- `hn_signal` blending with base score

### Integration: `POST /api/collect { source_types: ['hn'] }`

- HN stories appear in `raw_items` with correct `source_type='hn'`
- HN `source_metadata_json` is persisted
- Cluster receives HN `source_metadata` for scoring

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/adapters/hackernews/types.ts` | Create (`HnStory` interface, `HnAdapter` interface) |
| `backend/src/adapters/hackernews/fetchHnStories.ts` | Create (`fetchHnStories` implementation) |
| `backend/src/adapters/hackernews/index.ts` | Create (re-exports from `types.ts` + `fetchHnStories.ts`) |
| `backend/src/adapters/index.ts` | Modify (export HN adapter) |
| `backend/src/services/personalization/scoreCluster.ts` | Modify (HN signal integration) |
| `backend/src/routes/api.ts` | Modify (source_types includes 'hn') |
| `backend/src/config.ts` | Modify (PIH_HN_* env vars) |
| `backend/src/db/schema.ts` | Modify (hn_position_tracking table) |
| `backend/tests/hackernews-adapter.test.ts` | Create |
| `backend/tests/hackernews-velocity.test.ts` | Create |

## Milestone

This is **D1** of v2 (D → B → A sequence). Completion criteria:
- [ ] HN adapter fetches Top/New/Best stories via Firebase API
- [ ] Position and velocity stored in `raw_items.source_metadata_json`
- [ ] `hn_position_tracking` table created and populated each round
- [ ] Velocity signal influences personalization score
- [ ] All new tests pass
- [ ] Existing `/api/collect` continues to work for all source types

## Open Questions (Resolved)

- **Why not trigger HN notifications directly?** HN velocity is a ranking signal, not a standalone alert. Push notifications are driven by `significant_change_score` via the existing notification policy. HN stories that warrant notification will be captured through the normal clustering → signal → notification flow.
