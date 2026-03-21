# Personal Information Hub (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> NOTE: This workspace currently appears empty, so the plan initializes a fresh monorepo and creates all required files from scratch.

**Goal:** Build a local always-on personal information hub that aggregates RSS/social/tech/community inputs, clusters them into event clusters, extracts structured decision signals with evidence links, displays a mixed homepage, and sends low-noise key-change reminders via browser Web Push.

**Architecture:** Monorepo with `backend` (API + ingestion + clustering + signal extraction + knowledge store + Web Push) and `frontend` (homepage + search + consent UI). Shared schemas/types live in `shared/` and are validated with Zod.

**Tech Stack:** TypeScript, Node.js, Fastify (backend), React + Vite (frontend) or Next.js (frontend), SQLite (local store) with migrations, Zod for schema validation, and a pluggable “LLM signal extractor” provider (cloud or local) for structured extraction.

> **Git：** 已配置 `origin` 后，日常提交/推送与分支习惯见 `docs/git-workflow.md`。计划中各任务的 **「Commit」** 表示**适合打一次提交的里程碑**，可按需合并为一次或多次 commit。

---

## Task 0: Repo + environment scaffolding
**Files:**
- Create: `package.json` (monorepo root)
- Create: `backend/`, `frontend/`, `shared/`
- Create: `README.md`
- Create: `.env.example`
- Modify: none (new)

### Task 0.1: Initialize monorepo structure
- [ ] Step 1: Create directories: `backend/`, `frontend/`, `shared/`
- [ ] Step 2: Add root `package.json` with workspaces
- [ ] Step 3: Add `tsconfig` base config and scripts (`dev`, `build`, `test`)
- [ ] Step 4: Smoke run `pnpm -r build` (or `npm` equivalent)
- [ ] Step 5: Commit

### Task 0.2: Add local dev configuration
- [x] Step 1: 根目录 `.env.example`（`DATABASE_URL`、`PORT`、`PIH_*`、`LLM` 可选注释）
- [x] Step 2: `backend/src/config.ts` — `loadAppConfig()`（端口、`PIH_SIGNAL_EXTRACTOR`）；`server.ts` 入口使用
- [ ] Step 3: Run `backend` and confirm server starts
- [ ] Step 4: Commit

---

## Task 1: Shared schemas (evidence, signals, clustering)
**Files:**
- Create: `shared/src/schemas/*.ts` (Zod schemas)
- Create: `shared/src/types.ts` and exports
- Test: `shared/tests/schema.test.ts`

### Task 1.1: Encode schema v1 invariants
- [x] Step 1: Implement Zod schemas for:
  - `EvidenceSnippet` (snippet_text <= 600)
  - `EvidenceRef` (includes `extractor_version`, structural `extracted_spans[]`)
  - `EvidenceLink`
  - `DecisionSignals` (each field includes `evidence_links: EvidenceLink[]` and `change_policy_used: C`)
  - `Cluster` (includes `representative_cluster_id`, `created_at_utc`)
- [x] Step 2: Add schema validation unit tests:
  - rejects any `EvidenceSnippet.snippet_text > 600`
  - rejects `extracted_spans` containing text fields
- [x] Step 3: Run `shared` tests
- [ ] Step 4: Commit

### Task 1.2: Add deterministic identifiers
- [x] Step 1: Implement pure functions:
  - `clusterId(canonical_signature, clustering_model_version)` using `SHA-256_hex`
  - `evidenceRefId(normalized_item_id, extractor_version)`
  - `signalFingerprint(signal_schema_version, change_type, evidence_ref_ids, change_policy_used, disagreementStructHash)`
  - `disagreementStructHash(risk_summary, opportunity_summary, dispute_summary, sides, coverage_gaps)`
  - `eventKey(representative_cluster_id)`
- [x] Step 2: Add unit tests with known vectors (`shared/tests/ids.test.ts`)
- [ ] Step 3: Commit

---

## Task 2: Backend core (API, storage, auth-lite, round orchestration)
**Files:**
- Create: `backend/src/server.ts`, `backend/src/routes/*.ts`
- Create: `backend/src/db/*` (migrations + repositories)
- Create: `backend/src/services/round/*` (collection round orchestrator)
- Test: `backend/tests/*`

### Task 2.1: Add database + migrations
- [ ] Step 1: Define SQLite tables for:
  - `sources`
  - `raw_items`
  - `normalized_items`
  - `clusters` (incl. representative + created_at_utc)
  - `cluster_aliases`, `cluster_parents`
  - `evidence_snippets`
  - `evidence_refs`
  - `evidence_links`
  - `decision_signals`
  - `knowledge_entries` (or views mapping from decision_signals)
  - `notification_subscriptions`
  - `notification_event_log`
  - `collection_rounds`
- [ ] Step 2: Write migrations + verify schema creation
- [ ] Step 3: Commit

### Task 2.2: Implement API endpoints (minimal UI support)
- [x] Step 1: Create endpoints:
  - `POST /api/collect` (manual collect now)
  - `GET /api/homepage` (decision cards, topic board, timeline feed)
  - `GET /api/knowledge/search?q=&tags=`（`tags` 逗号分隔，OR 匹配解析后的 `tags_json`；无 tag 时 `LIMIT 20`，有 tag 时先拉至多 100 条再过滤再截断 20）
  - `POST /api/push/subscribe` and `POST /api/push/unsubscribe`
  - `GET /api/push/consent`
- [x] Step 2: auth-lite — 非空 `PIH_PUSH_API_TOKEN` 时，`POST` `subscribe` / `unsubscribe` / `enqueue-test` / `send` 需 `Authorization: Bearer` 或 `X-PIH-Token`（`auth/pushApiToken.ts` + `loadAppConfig`）；未设置 token 时保持本地开发无头认证
- [x] Step 3: `push-auth.test.ts`、`pushApiToken.test.ts`；既有 `api.test.ts` push 用例在未设 token 时仍通过
- [ ] Step 4: Commit

---

## Task 3: Ingestion adapters (RSS + “social via RSS” + tech community)
**Files:**
- Create: `backend/src/adapters/rss/*`
- Create: `backend/src/adapters/social_rss/*` (counts as “social”)
- Create: `backend/src/adapters/tech_github_rss/*` (or HN RSS)
- Create: `backend/src/services/ingestion/*`

### RSS feed configuration (product priority 2026-03)
- [x] Persist `rss_feed_configs` (social/tech feed URLs, optional label, unique URL)
- [x] API: `GET/POST/DELETE /api/feeds`, `POST /api/collect` with `{ useStoredFeeds: true }`
- [x] Frontend: **信源 / Sources** tab — add/remove feeds, **按信源采集**

### Bookmarks / curated imports (E — product priority 2026-03)
- [x] `source_type: bookmark` in `raw_items` + normalize rules (no tech “Updated:” strip on user notes)
- [x] `POST /api/import/bookmarks` — JSON `items[]` (`url`, `title?`, `folder?`, `note?`, `addedAt?`), dedup by URL hash, max 500
- [x] Reuse `runIngestionPipeline` (normalize → cluster → signals → knowledge → optional push enqueue)
- [x] Frontend: JSON textarea + **导入并跑管线** on Sources tab

### Personalization v1 (rules + personas + feedback)
- [x] SQLite: `personalization_keyword_rules`, `personalization_personas`, `personalization_feedback`
- [x] `GET/PUT /api/personalization`, `POST /api/personalization/feedback`; homepage + search: score, deny filter, reorder
- [x] Frontend **个性化** tab (allow/deny lines + persona JSON); decision cards, search hits, **timeline** rows: reasons + 赞/踩/清除/收藏
- [x] Playwright: `personalize tab loads and saves rules` in `e2e/mvp-acceptance.spec.ts`

### Task 3.1: RSS adapter (baseline A/B/D)
- [x] Step 1: Implement RSS fetch + parse (`adapters/rss/*`, collect pipeline)
- [x] Step 2: Dedup by `external_id` first-wins (`collectRssFromUrl`)
- [x] Step 3: Unit tests (`rss-parser.test.ts`, `rss-collect.test.ts`)
- [ ] Step 4: Commit

### Task 3.2: Social adapter via user-provided RSS (B)
- [x] Step 1: Social feeds via `rss_feed_configs` + `/api/collect` / `useStoredFeeds`
- [x] Step 2: `source_type: social` in collect path
- [x] Step 3: Covered by collect/parser tests + API ingest tests
- [ ] Step 4: Commit

### Task 3.3: Tech community adapter (D)
- [x] Step 1: `adapters/tech/knownFeeds.ts` — `HACKER_NEWS_FRONT_PAGE_RSS`、`githubReleasesAtomUrl(owner,repo)`（采集仍走既有 `source_type: tech` + RSS 管线）
- [x] Step 2: 与社媒相同 `parseRssXml` → `raw_items`（用户在信源中粘贴 HN URL 即可）
- [x] Step 3: `tests/tech-hn-rss.test.ts`（HN 形 fixture，无网络）
- [ ] Step 4: Commit

---

## Task 4: Normalize + de-noise + extract excerpts
**Files:**
- Create: `backend/src/services/normalize/*`
- Test: `backend/tests/normalize.test.ts`

### Task 4.1: Normalize fields and de-noise templates
- [x] Step 1–3: `normalizeRawItem` / `normalizeText`（摘录长度、社媒/技术/书签前缀规则）
- [x] Step 4: `normalize.test.ts`
- [ ] Step 5: Commit

---

## Task 5: Dedup + clustering + event/topic kinds
**Files:**
- Create: `backend/src/services/cluster/*`
- Test: `backend/tests/cluster/*.test.ts`

### Task 5.1: Canonical signature + stable cluster ids
- [x] Step 1–4: `clusterNormalizedItemsForRound` + `clusters` 表字段
- [x] Step 5: `cluster.test.ts`（`isoWeekBucket`、同输入 `clusterId`、二次跑管线 representative/canonical 不变）
- [ ] Step 6: Commit

### Task 5.2: Merge/split with alias/parent links
- [x] Step 1: Merge v1 — `content_summary` 词袋 **Jaccard > 0.7** 则新 canonical 簇行写入 `representative_cluster_id` 指向已有**证据根簇**，`cluster_evidence` 只挂根 id（`mergeUtils.ts` + `clusterNormalizedItemsForRound`）
- [x] Step 2: v1 MVP — 合并到**已存在根簇**（不 reparent 更早根，避免大规模迁移）；已存在 `clusters` 行则冻结代表关系（沿用 `INSERT OR IGNORE`）
- [x] Step 3: 别名即 `cluster_id ≠ representative_cluster_id`；`/api/knowledge/cluster` 对别名 id 会 **resolve** 到根再查 `knowledge_entries`
- [x] Step 4: Split — `minBipartitionJaccard` 最小切分 Jaccard **< 0.4** 且 **连续 N=2 轮**（`cluster_split_state` + `last_round_id` 去重）；拆出子根簇并写入 `cluster_parents`；`splitClusters.ts` + 每轮末尾 `maybeSplitClustersAfterRound`（**无新 normalized 的轮次也会跑**）
- [x] Step 5: `mergeUtils.test.ts`（含 `minBipartitionJaccard`）、`cluster-merge.test.ts`（含空轮 split）；既有 representative freeze 单测仍适用
- [x] Step 6: Commit

### Task 5.3: Determine `cluster_kind` (event_update vs topic_drift)
- [x] Step 1–2: `extractSignalsForRound` + `cluster_timeline_state`（证据集 hash 变化 → `event_update`，否则 `topic_drift`）；`clusterKindFromDeltas` 纯函数单测
- [ ] Step 3: Commit

---

## Task 6: Signal extraction (LLM) with structured output + change policy C
- [x] **Persist gate:** `extractSignalsForRound` 在写入 `decision_signals` 前用 `@e-cu/shared` 的 `DecisionSignalsSchema` 校验（与 Zod v1 结构对齐）。
**Files:**
- Create: `backend/src/services/signal_extraction/*`
- Create: `backend/src/services/embeddings/*` (optional, with deterministic interface)
- Test: `backend/tests/signal_extraction.test.ts`

### Task 6.1: Define deterministic claim_text for embeddings
- [x] Step 1: `buildClaimTextFromDecisionSignals`（`services/signal_extraction/buildClaimText.ts`，与设计稿公式一致）
- [x] Step 2: `backend/tests/signal_extraction.test.ts`
- [ ] Step 3: Commit

### Task 6.2: Implement extractor prompt + JSON schema validation
- [x] Step 1（部分）: `decisionSignalsBuilder.ts` — 占位抽取与证据链构造可复用；**真实 LLM prompt** 仍待接
- [x] Step 2: 落库前 `DecisionSignalsSchema.safeParse`（已有）
- [x] Step 3: `decision_signals` 存储（已有）
- [x] Step 4: change policy `C` — `PIH_CHANGE_POLICY` 全局覆盖；否则按本轮簇内证据 `source_type`：`bookmark`→`USER_OVERRIDE`，仅 `tech`→`SOURCE_TRUSTED`，含 `social`→`EVIDENCE_WEIGHTED`，默认 `LATEST_WINS`（`changePolicyResolver.ts` + `extractSignalsForRound`）
- [x] Step 5: **Mock 路径** — `PIH_SIGNAL_EXTRACTOR=mock|mock_llm` 或 `extractSignalsForRound(..., { forceMockOverlay: true })` 给结构化 summary 加 `[mock_llm]` 前缀；`tests/extractSignals-mock.test.ts`
- [ ] Step 6: Commit

---

## Task 7: Knowledge store + keyword/tag search (v1)
**Files:**
- Create: `backend/src/services/knowledge/*`
- Test: `backend/tests/knowledge.test.ts`

### Task 7.1: Persist structured entries and search
- [x] Step 1: Map DecisionSignals to KnowledgeEntry with tags
- [x] Step 2: Implement keyword/tag search (v1, deterministic ranking)
- [x] Step 3: Integration tests for search recall/precision on fixture datasets (`backend/tests/knowledge-search.test.ts`：摘要/片段/tags 召回、同分按 `cluster_id` 排序、allow 加权、deny 过滤、`LIMIT 20`、timeline→level)
- [ ] Step 4: Commit

---

## Task 8: Web Push（**当前迭代推迟**；先完成采集/聚类/信号/知识/个性化与验证）
> 与浏览器订阅、Service Worker 产品面相关的工作延后；后端通知队列与 `PIH_PUSH_ENABLED` 测试可保留，不作为近期交付阻塞。

## Task 8: Web Push (Service Worker + subscriptions + dedup)
**Files:**
- Create: `frontend/public/sw.js` (service worker)
- Create: `frontend/src/push/*`
- Create: `backend/src/services/push/*`
- Test: `backend/tests/push.test.ts`

### Task 8.1: Implement subscription management endpoints
- [ ] Step 1: Frontend: request notification permission, subscribe, POST to backend
- [ ] Step 2: Backend: store encrypted subscription payload
- [ ] Step 3: Backend: persist `push_permission_status` and `consent_timestamp`
- [ ] Step 4: Implement unsubscribe (delete subscription + log)
- [ ] Step 5: Commit

### Task 8.2: Reminder trigger + dedup
- [ ] Step 1: Implement reminder scoring as pure, unit-testable functions:
  - `computeEvidenceNovelty(evidence_ref_ids_old, evidence_ref_ids_new) -> [0,1]` (Jaccard)
  - `buildClaimTextFromDecisionSignals(decisionSignals) -> claim_text` (deterministic, no EvidenceSnippet.snippet_text)
  - `computeConclusionDelta(claim_embedding_old, claim_embedding_new) -> [0,1]`
  - `computeConflictStrength(conflict_links) -> [0,1]` using `contradicts/supports` link_confidence sums
  - `computeConflictDelta(strength_old, strength_new) -> [0,1]` with `clamp(new-old,0,1)`
  - `computeSignificantChangeScore(score_parts, w1/w2/w3) -> [0,1]`
- [ ] Step 2: Map `significant_change_score` to `reminder_level` with v1 thresholds:
  - `high >= 0.8`
  - `medium in [0.5, 0.8)`
- [ ] Step 3: Apply `topic_drift` push exception from spec:
  - default: no Web Push for `topic_drift`
  - exception: allow Web Push when `reminder_level == high` AND the `w3*conflict_delta` component is the dominant contributor (e.g., `w3*conflict_delta >= max(w1*evidence_novelty, w2*conclusion_delta)`)
- [ ] Step 4: Compute dedup identifiers deterministically:
  - `event_key = representative_cluster_id`
  - `evidence_ref_ids = sorted(union of (EvidenceRef.normalized_item_id + "|" + EvidenceRef.extractor_version) across all evidence_links)`
  - `signal_fingerprint = SHA-256_hex(...)` using evidence_ref_ids and structured hashes
- [ ] Step 5: Enforce push rate limit: `max_push_per_event_key = 1 per 7 days` via `NotificationEventLog`
- [ ] Step 6: Backend sends Web Push payload with strict keyset:
  - payload keys MUST be exactly: `event_key`, `reminder_level`, `title`, `short_summary`
  - `short_summary` MUST come only from structured summaries (`change_summary/risk_summary/...`) and MUST NOT vary when only `EvidenceSnippet.snippet_text` changes
- [ ] Step 7: Integration tests with seeded decision signals verifying:
  - identical signals do not push repeatedly (dedup + fingerprint)
  - payload has strict keyset equality
  - payload never contains `snippet_text`
  - topic_drift exception allow: when `reminder_level == high` and `w3*conflict_delta` is dominant, topic_drift should push
  - topic_drift exception block: when `reminder_level == high` but `w3*conflict_delta` is NOT dominant, topic_drift should not push
  - short_summary invariance: changing only `EvidenceSnippet.snippet_text` (while keeping structured summaries identical) must keep payload `short_summary` unchanged
  - boundary tests for score mapping (0.8, 0.799, 0.5, 0.499)
  - cooldown tests: second push within 7 days is blocked; after 7 days allowed
- [ ] Step 8: Commit

---

## Task 9: Frontend (mixed homepage + timeline + search + consent)
**Files:**
- Create: `frontend/src/pages/*`
- Create: `frontend/src/components/*` (cards, topic board, timeline list)

### Task 9.1: Mixed homepage
- [x] Step 1–4: `App.tsx` 首页 Tab + `/api/homepage`（决策卡、主题板、时间线；等级过滤）
- [x] Step 5: Playwright `mvp-acceptance.spec.ts`
- [ ] Step 6: Commit

### Task 9.2: Knowledge search UI
- [x] Step 1–3: 搜索 Tab、`/api/knowledge/search`、聚类详情 + timeline evidence
- [ ] Step 4: Commit

### Task 9.3: Consent + notification UI
- [ ] Step 1: Add UI to request/deny/withdraw push permissions (**deferred**: current release ships without Web Push product surface; set `PIH_PUSH_ENABLED=true` to use push APIs)
- [ ] Step 2: Validate UX with backend consent endpoints (deferred with Step 1)
- [ ] Step 3: Commit

---

## Task 10: Verification, privacy assertions, and end-to-end tests
**Files:**
- Modify: `backend/tests/*`, `frontend/tests/*`, `shared/tests/*`

### Task 10.1: Evidence privacy and “no full text persistence” tests
- [x] Step 1–3: `api.test.ts` `privacy: should enforce snippet limit and avoid disallowed full-text fields`（长 description 管线、`full_text`/`body_html`/`original_body` 键扫描、`knowledge_entries` 列）
- [ ] Step 4: Commit

### Task 10.2: End-to-end MVP acceptance tests
- [x] Step 1: Mock ingestion sources and run `/api/collect` (covered in `backend/tests/api.test.ts`)
- [x] Step 2: Assert homepage renders and includes at least one decision card (Playwright `e2e/mvp-acceptance.spec.ts`)
- [x] Step 3: Notification dedup across rounds (Vitest + `PIH_PUSH_ENABLED=true`; Web Push off by default in product)
- [ ] Step 4: Commit

---

> Plan file: `docs/superpowers/plans/2026-03-20-personal-information-hub-v1-implementation-plan.md`

