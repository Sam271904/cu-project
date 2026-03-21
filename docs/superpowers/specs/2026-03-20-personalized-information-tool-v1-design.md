# Personal Information Hub (v1) - Overall Design

## Summary

This project provides a browser-accessible “personal information hub” that aggregates and de-noises curated information sources, ranks them according to your interests, extracts structured “decision signals” (change / risk / opportunity / disagreement), and triggers key-change reminders via browser Web Push (works even when the page is not open).

v1 scope is aligned with: sources `A+B+D+E`, personalization `D`, mixed homepage, key reminders by **event clusters**, deployed as a **local always-on backend** with Web Push for notifications. Cloud is allowed to participate in processing, but the knowledge store does **not** persist original full texts (only summaries/structured data).

## Goals

1. Aggregate and de-noise content from selected sources.
2. Understand what you care about using a hybrid approach:
  - interest rules (black/white/keywords)
  - topic “personas”
  - lightweight feedback (like / dislike / save)
3. Present a mixed homepage:
  - decision signal area
  - topic board
  - timeline feed
4. Extract and present structured “decision signals” for your review.
5. Trigger low-noise reminders for key changes:
  - trigger at the **event cluster** level (not single article)
  - compute and update cluster state across collection rounds
6. Support knowledge retention (D):
  - store structured summaries + evidence references
  - enable fast keyword/tag search (v1)

## Non-goals (v1)

1. Perfect coverage of every social/video platform.
2. Full-fidelity content archiving (original full texts are not stored).
3. Fully automated “trust-grade” forecasting; signals are explainable and evidence-linked.

## User Inputs / Personalization Model

Personalization uses:

1. Rules: keyword allow/deny lists, topic weighting, source weighting.
2. Topic personas: user-defined topic dimensions (e.g., AI tools, macro, health).
3. Feedback loop:
  - save / like => increase weights for related clusters
  - hide / dislike => decrease weights
  - optional “relevance” labels during review

All personalization outputs must include “why relevant” (explainability) in v1.

## Change Decision Policy (C)

When extracting `Change` signals, v1 uses the user choice `C` to resolve how “truth” is decided between:

- the newly seen evidence/conclusion
- previously extracted claims for the same cluster

For v1, we map `C` to a truth policy enum:

- `LATEST_WINS`: prefer the newest conclusion when it conflicts with previous ones
- `EVIDENCE_WEIGHTED`: prefer conclusions supported by higher-quality evidence
- `SOURCE_TRUSTED`: prefer conclusions from higher-trust sources
- `USER_OVERRIDE`: if user marks the outcome, lock it for the cluster timeline

`C` is recorded for each extracted `DecisionSignals` so the output is auditable and reproducible across versions.

## Information Sources (v1)

Selected sources:

1. A: News / RSS (RSS feeds and/or supported news endpoints)
2. B: Social media (only what can be accessed legally and reliably)
3. D: Technology communities (e.g., GitHub / Hacker News / technical blogs that can be integrated)
4. E: User’s curated inputs (bookmarks/imports, “read later” exports)

Ingestion must normalize all sources into a unified raw item format.

## Architecture Overview (7 Modules)

1. Ingestion (采集层)
  - Fetch from configured adapters (RSS, social, tech communities, imports).
  - Primary mode: **manual “collect now”** trigger; scheduled runs are only fallback.
  - Output: `raw_items[]` (source, title, timestamps, excerpt/summary, link, metadata).
2. Normalize (清洗与规范化)
  - Standardize fields (time formats, language, author/source naming).
  - De-noise obvious templates / duplicated boilerplate.
  - Output normalized `content_summary` and `content_text_or_excerpt` (excerpt only; no full text storage).
3. Dedup & Cluster (去重与聚类)
  - Document-level dedup (canonicalized URL/title + time heuristics).
  - Semantic clustering: group items that refer to the same event/topic update.
  - Output: stable `cluster_id` and cluster evidence set.

### Cluster stability & `cluster_id` generation

To avoid cluster id churn across collection rounds:

1. Define `canonical_signature` as a reproducible anchor derived from normalized entities (e.g., source domain + normalized topic/entity name + coarse time window bucket).
2. Generate:
  - `cluster_id = SHA-256_hex( canonical_signature + "|" + clustering_model_version )`
3. Merge/split strategy:
  - Merge: if new evidence coverage overlap with an existing cluster representative exceeds `0.7`, create an alias rather than replacing the old cluster id (`cluster_aliases[]`); the alias must point to that representative's persisted `representative_cluster_id`.
  - Split: if the evidence subset overlap drops below `0.4` and this split persists for `N=2` consecutive collection rounds, create a new cluster and keep a link from the old cluster via `cluster_parents[]`.

### Determinism notes

To keep canonicalization stable:

- `canonical_signature` is frozen when the cluster is first created (subsequent evidence should not mutate it).
- The time bucket used in `canonical_signature` is derived from `published_at_utc` of the *first seed evidence* and normalized to ISO week (`YYYY-Www`).

### Representative cluster / `event_key` determinism
To keep Web Push dedup stable:
1. Each cluster group has a persisted `representative_cluster_id`.
2. On initial cluster creation:
   - `created_at_utc` is set once
   - `representative_cluster_id = cluster_id`
3. On merge (new clusters become aliases of an existing representative):
   - pick the representative with the earliest `created_at_utc` among merge candidates
   - `representative_cluster_id` never changes after it is set
4. `event_key` must use `representative_cluster_id` (never an alias cluster id).

1. Personalization Ranking (个性化排序)
  - Compute relevance scores per cluster:
    - topic persona match
    - rule-based weighting
    - feedback adjustment
  - Output: ranked clusters plus “why” tags.
2. Signal Extraction (信号抽取, v1 focus)
  For each cluster, maintain a compact state timeline across collection rounds.
   Extract structured signals with evidence links:
  - Change (结论层 + 证据层都要, user choice C)
    - change_summary
    - change_type: added / corrected / inverted / supplemented / unknown
    - evidence_links (EvidenceLink[]) to support the change
    - change_policy_used: `C` (truth policy enum)
    - decision_rationale_policy: {rules_applied: [...], evidence_weighting_method: "..."}
  - Risk (风险)
    - risk_summary
    - evidence_links (EvidenceLink[])
  - Opportunity (机会)
    - opportunity_summary
    - evidence_links (EvidenceLink[])
  - Disagreement (分歧)
    - dispute_summary
    - sides (side_1/side_2 or multiple)
    - coverage_gaps (what is missing)
    - evidence_links (EvidenceLink[])

### Evidence data retention (no persistent full texts)

To preserve traceability without storing original full text:

1. Each evidence reference must include a minimal structured payload:
  - `EvidenceSnippet`: `{snippet_text (<= 600 chars), snippet_language, extractor_version}`
  - `EvidenceRef`: `{normalized_item_id, url, published_at, extractor_version, confidence (0..1), extracted_spans[]}`
    - `extracted_spans[]` MUST be non-text structural spans only:
      - `{start_char (int>=0), end_char (int>start_char), span_type, confidence (0..1)}`
    - `start_char/end_char` are offsets within `EvidenceSnippet.snippet_text`
2. EvidenceLink (统一证据引用结构) 定义为：
  - `EvidenceLink`: `{evidence_ref: EvidenceRef, evidence_snippet?: EvidenceSnippet, role: "supports"|"contradicts"|"context", link_confidence (0..1)}`
3. The knowledge store persists only:
  - `EvidenceSnippet` + `EvidenceRef` metadata
4. Data-flow restriction:
  - cloud processing may receive excerpt/snippet only
  - original full text caches must be discarded after processing (enforced by TTL/storage limits)
5. Knowledge Store (知识沉淀, D落地)
  - Store structured summaries and evidence references only.
  - No original full texts persisted.
  - Provide retrieval for:
    - keyword/tag search (v1)
    - timeline replay (event cluster evolution)
6. Frontend & Notifications (展示与提醒)
  - Homepage layout:
    - Top: decision signal cards
    - Middle: topic board
    - Bottom: timeline feed
  - Web Push:
    - browser subscription stored server-side (local backend)
    - reminder triggers computed by “new high-value change cluster” logic
    - avoid duplicates via last-notified `event_key` + `signal_fingerprint` within cooldown windows

### Web Push privacy & payload constraints

To reduce privacy risk:

1. Push payload MUST NOT include original snippets or long evidence text.
2. Push payload minimal fields:
  - `event_key`
  - `reminder_level` (high/medium)
  - `title`
  - `short_summary` (<= 120 chars)
  - `short_summary` MUST be derived from structured summaries (e.g., `change_summary` / `risk_summary`), and MUST NOT be constructed from `EvidenceSnippet.snippet_text` or `extracted_spans`.
3. Subscription storage:
  - store encrypted at rest (device-local key)
  - support unsubscribe flow that deletes subscription and logs
4. Consent state:
  - track `push_permission_status` and `consent_timestamp`
  - add “reject/withdraw => no push” test coverage
5. Server exposure:
  - local backend binds to explicit host/port
  - subscription APIs require an auth token from the local UI session
  - notification delivery to the push service uses VAPID (handled server-side)

## Data Model (Conceptual)

Entities (minimum v1):

- `Source`: {source_type, name, config_ref}
- `RawItem`: {source_id, external_id, title, published_at?, collected_at, url, excerpt_or_summary, author?, language, timestamp_quality (high|medium|low)}
- `NormalizedItem`: {normalized fields + `content_summary` + `content_text_or_excerpt`, extractor_version}
- `Cluster`: {cluster_id, representative_cluster_id, created_at_utc, canonical_signature, cluster_aliases[], cluster_parents[], cluster_kind (event_update|topic_drift), topic_labels, last_updated_at, clustering_model_version}
- `ClusterEvidence`: link cluster to normalized items with relevance scores
- `ClusterTimelineState`: {collection_round_id, cluster_id, snapshot/deltas metadata}
- `EvidenceSnippet`: {snippet_text (<= 600 chars), snippet_language, extractor_version}
- `EvidenceRef`: {normalized_item_id, url, published_at, extractor_version, confidence (0..1), extracted_spans[]}
  - `extracted_spans[]` MUST be non-text structural spans only (offsets within `EvidenceSnippet.snippet_text`), never span_text
- `EvidenceLink`: {evidence_ref: EvidenceRef, evidence_snippet?: EvidenceSnippet, role: "supports"|"contradicts"|"context", link_confidence (0..1)}
- `DecisionSignals`: {cluster_id, signal_schema_version, change/risk/opportunity/disagreement fields (each includes evidence_links: EvidenceLink[]), change_policy_used: C}
- `KnowledgeEntry`: structured extracted conclusions with tags and evidence pointers
- `NotificationPolicy`: thresholds + dedup rules (cooldown_window, high/medium thresholds)
- `NotificationEventLog`: records sent reminders (for auditing & dedup)

### Versions & invariants (recommended v1 defaults)

- All timestamps are normalized to UTC ISO8601.
- Relevance score is always in `[0,1]`.
- For pushed reminders, evidence references must be reproducible via `EvidenceRef` fields (url + published_at + extractor_version).

## Key Change Reminder Logic

Reminder trigger strategy: **event-cluster-level** (而非单条文章级别）。

1. After each collection round, compute whether a cluster has “newly significant change”.
2. Compute `significant_change_score` in `[0,1]`:
  - `significant_change_score = w1 * evidence_novelty + w2 * conclusion_delta + w3 * conflict_delta`
  - default weights (sum=1): `w1=0.4, w2=0.4, w3=0.2` (configurable in `NotificationPolicy`)
  - `evidence_novelty`: `1 - Jaccard_sim(old_evidence_refs, new_evidence_refs)`
    - `evidence_ref_id = normalized_item_id + "|" + extractor_version`
    - `old_evidence_refs`: set of `evidence_ref_id` referenced by the previous round `DecisionSignals` for this cluster representative
    - `new_evidence_refs`: set of `evidence_ref_id` referenced by current round `DecisionSignals` for this cluster representative
  - `conclusion_delta`: `1 - cosine_sim(claim_embedding_old, claim_embedding_new)`
    - `claim_embedding_*` is computed from deterministic structured claim text (after applying `change_policy_used: C`)
    - deterministic `claim_text` construction (v1):
      - `claim_text = "CHANGE:" + change_summary + "||RISK:" + risk_summary + "||OPP:" + opportunity_summary + "||DISPUTE:" + dispute_summary + "||SIDES:" + join(sides, ",") + "||GAPS:" + join(coverage_gaps, ",")`
    - embeddings are computed from `claim_text` only (no `EvidenceSnippet.snippet_text`).
  - `conflict_delta`: computed deterministically into `[0,1]` from disagreement evidence links
    - per-round `conflict_strength`:
      - `contradict_conf = sum(link_confidence for EvidenceLinks in Disagreement where role=="contradicts")`
      - `support_conf = sum(link_confidence for EvidenceLinks in Disagreement where role=="supports")`
      - `conflict_strength = contradict_conf / (contradict_conf + support_conf + 1e-9)`
    - `conflict_delta = clamp(conflict_strength_new - conflict_strength_old, 0, 1)`
3. Classify into reminder levels:
  - `high`: send Web Push
  - `medium`: show prominently in homepage but do not push
4. Dedup (deterministic):
  - `event_key = representative_cluster_id` (the primary cluster for the timeline; aliases resolve to representative id)
  - `evidence_ref_ids = sorted(union of (EvidenceRef.normalized_item_id + "|" + EvidenceRef.extractor_version) for all evidence_links referenced in this DecisionSignals instance)`
  - `disagreement/risk/opportunity_struct_hash = SHA-256_hex( risk_summary + "|" + opportunity_summary + "|" + dispute_summary + "|" + sides + "|" + coverage_gaps )`
  - `signal_fingerprint = SHA-256_hex( signal_schema_version + "|" + change_type + "|" + sorted(evidence_ref_ids) + "|" + change_policy_used + "|" + disagreement/risk/opportunity_struct_hash )`
  - maintain `NotificationEventLog` with `(user_id + event_key + signal_fingerprint)` within `cooldown_window`
  - default v1 thresholds (tunable):
    - high >= `0.8`
    - medium in `[0.5, 0.8)`
  - reminder max rate:
    - `max_push_per_event_key = 1 per 7 days`

### event_update vs topic_drift reminder rules

To reduce noise:

- `event_update`: `cluster_kind` computed when `conclusion_delta >= 0.6` OR `conflict_delta >= 0.5`
- `topic_drift`: all other clusters; default only appears on homepage (no Web Push), unless it pushes `significant_change_score` into `high` primarily via `conflict_delta`

## Deployment (Local Only)

- The backend ingestion/processing runs on your own machine (always-on).
- The browser connects to the local service for UI.
- Web Push uses browser subscription; no separate mail provider needed.

Cloud participation is allowed for processing, but v1 storage policy:

- only summaries/structured outputs are persisted as knowledge.

## MVP Deliverables (v1)

1. UI:
  - mixed homepage (decision signals / topic board / timeline feed)
2. Ingestion adapters for:
  - RSS
  - imports (bookmarks/exports)
  - at least one “social” and one “tech community” adapter that you can actually use
3. Dedup and event clustering (baseline heuristics + semantic grouping)
4. Signal extraction (structured change/risk/opportunity/disagreement with evidence)
5. Knowledge store with keyword/tag search
6. Web Push reminders with dedup and reminder thresholds

## Error Handling & Reliability

1. Source failures should not break the whole pipeline (adapter-level isolation).
2. Partial ingestion is acceptable; cluster updates must be consistent.
3. Web Push:
  - gracefully handle unsupported browsers and permission issues
  - keep an event log for debugging and dedup verification
4. Adapter reliability (recommended):
  - each adapter has `retry_policy={max_attempts=3, backoff=exponential, jitter=true}`
  - each adapter has `rate_limit_per_minute` to avoid bans

## Testing Strategy (v1)

1. Unit tests:
  - URL canonicalization
  - dedup signature logic
  - cluster stability: `cluster_id` should be stable across rounds given same canonical_signature and clustering_model_version
  - significant change scoring boundaries: verify high/medium split at thresholds
  - cluster merge/split heuristics (baseline)
  - signal schema validation
  - evidence schema validation:
    - every `EvidenceRef` includes `extractor_version`
    - `extracted_spans[]` contains only `{start_char,end_char,span_type,confidence}` and never contains any text fields
2. Integration tests:
  - a “collection round” end-to-end with mocked source adapters
  - evidence retention: ensure cloud/store inputs are snippet-only; verify no full-text persistence occurs
  - full-text prohibition checks:
    - the knowledge pipeline persists only an allowlisted set of evidence objects/fields (`EvidenceSnippet`, `EvidenceRef`, `EvidenceLink`, and their schema-allowed subfields)
    - `EvidenceSnippet.snippet_text <= 600` is always enforced before persistence
    - any temporary full-text caches must expire (enforced by TTL/storage limits) and be asserted observable in integration tests
  - reminder dedup: same event_key + signal_fingerprint within cooldown => no repeated push
3. E2E smoke:
  - run ingestion, update clusters, render homepage
  - Web Push consent matrix: allow/deny/withdraw => correct behavior
4. Notification tests:
  - verify dedup prevents repeated pushes for the same cluster change
  - payload constraint: pushed payload contains only minimal fields (no snippet_text)

## Metrics (v1)

1. Reminder precision proxy: percentage of pushed clusters you mark as relevant.
2. Noise rate: high-level pushes per week.
3. Knowledge retrieval success: time-to-find for known keywords/tags.
4. Pipeline latency: time from “collect now” to updated homepage.

## Open Questions

1. Which exact APIs/endpoints are feasible for your social sources?
2. How aggressive should clustering be for “event” vs “topic drift”?
3. Reminder thresholds tuning approach (manual vs semi-automatic).

