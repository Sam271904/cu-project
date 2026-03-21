import type Database from 'better-sqlite3';
import crypto from 'node:crypto';

import { DecisionSignalsSchema } from '@e-cu/shared';

import { loadAppConfig } from '../../config';
import { clusterKindFromSignals } from '../cluster/clusterNormalizedItemsForRound';
import { resolveChangePolicyFromSourceTypes } from './changePolicyResolver';
import { buildClaimTextFromDecisionSignals } from './buildClaimText';
import { fetchClaimEmbeddingOpenAiCompatible, parseEmbeddingJson } from './claimEmbeddingOpenAi';
import { truncateWithEllipsis } from '../normalize/normalizeText';
import {
  EVIDENCE_EXTRACTOR_VERSION,
  applyMockExtractorOverlay,
  buildEvidenceLinksFromNormalizedRow,
  buildPlaceholderDecisionSignals,
} from './decisionSignalsBuilder';
import { buildUserPrompt, fetchLlmSummariesOpenAiCompatible, mergeLlmSummariesIntoDecisionSignals } from './llmOpenAiCompatible';
import { isMockSignalExtractor } from './signalExtractorMode';
import { computeClaimTextHashFromDecisionSignals } from '../notifications/decisionSignalsFingerprint';
import {
  computeConflictDelta,
  computeConflictStrengthFromDisagreement,
  computeConclusionDeltaFromClaimHashes,
  computeConclusionDeltaFromEmbeddings,
} from '../notifications/reminderScoring';

let warnedOpenAiNoApiKey = false;
let warnedEmbeddingNoApiKey = false;

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export type ExtractSignalsOptions = {
  /** Task 6.2 tests / local experiments without touching process.env */
  forceMockOverlay?: boolean;
};

export async function extractSignalsForRound(
  db: Database.Database,
  roundId: number,
  uiLang: 'zh' | 'en' = 'en',
  opts?: ExtractSignalsOptions,
): Promise<void> {
  const clusters: Array<{ cluster_id: string }> = db
    .prepare(
      `
      SELECT DISTINCT c.cluster_id
      FROM clusters c
      JOIN cluster_evidence ce ON ce.cluster_id = c.cluster_id
      JOIN normalized_items n ON n.id = ce.normalized_item_id
      WHERE n.collection_round_id = ?
      ORDER BY c.cluster_id ASC
      `,
    )
    .all(roundId) as Array<{ cluster_id: string }>;

  const stmtUpsert = db.prepare(
    `
    INSERT OR REPLACE INTO decision_signals (cluster_id, signal_schema_version, change_policy_used, signals_json)
    VALUES (?, ?, ?, ?)
    `,
  );

  const stmtFirstEvidence = db.prepare(
    `
    SELECT
      n.id as normalized_item_id,
      n.content_summary,
      n.content_text_or_excerpt,
      n.language,
      r.collected_at,
      r.published_at,
      n.url
    FROM normalized_items n
    JOIN raw_items r ON r.id = n.raw_item_id
    JOIN cluster_evidence ce ON ce.normalized_item_id = n.id
    WHERE ce.cluster_id = ? AND n.collection_round_id = ?
    ORDER BY n.id ASC
    LIMIT 1
    `,
  );

  const stmtEvidenceExternalIds = db.prepare(
    `
    SELECT
      n.external_id as external_id
    FROM normalized_items n
    JOIN cluster_evidence ce ON ce.normalized_item_id = n.id
    WHERE ce.cluster_id = ? AND n.collection_round_id = ?
    ORDER BY n.id ASC
    `,
  );

  const stmtDistinctSourceTypes = db.prepare(
    `
    SELECT DISTINCT n.source_type AS source_type
    FROM normalized_items n
    JOIN cluster_evidence ce ON ce.normalized_item_id = n.id
    WHERE ce.cluster_id = ? AND n.collection_round_id = ?
    ORDER BY n.source_type ASC
    `,
  );

  const stmtPrevTimeline = db.prepare(
    `
    SELECT evidence_set_hash, claim_text_hash, claim_embedding_json, conflict_strength
    FROM cluster_timeline_state
    WHERE cluster_id = ? AND collection_round_id < ?
    ORDER BY collection_round_id DESC
    LIMIT 1
    `,
  );

  const stmtUpsertTimeline = db.prepare(
    `
    INSERT OR REPLACE INTO cluster_timeline_state
      (collection_round_id, cluster_id, evidence_set_hash, cluster_kind, evidence_ref_ids_json, claim_text_hash, conflict_strength, claim_embedding_json)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );

  const stmtEvidenceLinesForLlm = db.prepare(
    `
    SELECT n.content_summary, n.content_text_or_excerpt
    FROM normalized_items n
    JOIN cluster_evidence ce ON ce.normalized_item_id = n.id
    WHERE ce.cluster_id = ? AND n.collection_round_id = ?
    ORDER BY n.id ASC
    LIMIT 10
    `,
  );

  const mockMode = opts?.forceMockOverlay === true || isMockSignalExtractor();
  const appCfg = loadAppConfig();
  const { changePolicyOverride } = appCfg;

  if (appCfg.signalExtractor === 'openai_compatible' && !appCfg.llmApiKey && !warnedOpenAiNoApiKey) {
    warnedOpenAiNoApiKey = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[pih] PIH_SIGNAL_EXTRACTOR=openai_compatible but PIH_LLM_API_KEY / OPENAI_API_KEY is unset; using placeholder summaries',
    );
  }
  if (appCfg.claimEmbeddingEnabled && !appCfg.llmApiKey && !warnedEmbeddingNoApiKey) {
    warnedEmbeddingNoApiKey = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[pih] PIH_CLAIM_EMBEDDING enabled but PIH_LLM_API_KEY / OPENAI_API_KEY is unset; skipping embeddings',
    );
  }

  for (const c of clusters) {
    const evidenceRow = stmtFirstEvidence.get(c.cluster_id, roundId) as Record<string, unknown> | undefined;
    if (!evidenceRow) continue;

    const evidenceExternalRows = stmtEvidenceExternalIds.all(c.cluster_id, roundId) as Array<{ external_id: string }>;
    const evidenceExternalIds = evidenceExternalRows.map((r) => r.external_id);
    const evidenceRefIds = evidenceExternalIds.map((extId) => `${extId}|${EVIDENCE_EXTRACTOR_VERSION}`);
    const evidenceRefIdsSorted = [...evidenceRefIds].sort();
    const evidenceSetHash = sha256Hex(evidenceRefIdsSorted.join(','));
    const evidenceCount = evidenceExternalIds.length;

    const prev = stmtPrevTimeline.get(c.cluster_id, roundId) as
      | {
          evidence_set_hash: string;
          claim_text_hash: string | null;
          claim_embedding_json: string | null;
          conflict_strength: number | null;
        }
      | undefined;

    const evidence_links = buildEvidenceLinksFromNormalizedRow({
      ...evidenceRow,
      url: String(evidenceRow.url ?? ''),
    } as Parameters<typeof buildEvidenceLinksFromNormalizedRow>[0]);

    const clusterLabel =
      typeof evidenceRow.content_summary === 'string' && String(evidenceRow.content_summary).trim()
        ? String(evidenceRow.content_summary).trim()
        : `cluster_${c.cluster_id.slice(0, 8)}`;

    const sourceTypeRows = stmtDistinctSourceTypes.all(c.cluster_id, roundId) as Array<{ source_type: string }>;
    const changePolicy = resolveChangePolicyFromSourceTypes(
      sourceTypeRows.map((r) => r.source_type),
      changePolicyOverride,
    );

    let decisionSignals = buildPlaceholderDecisionSignals({
      clusterId: c.cluster_id,
      evidence_links,
      uiLang,
      evidenceCount,
      clusterLabel,
      changePolicy,
    });

    if (appCfg.signalExtractor === 'openai_compatible' && appCfg.llmApiKey) {
      try {
        const evRows = stmtEvidenceLinesForLlm.all(c.cluster_id, roundId) as Array<{
          content_summary: string;
          content_text_or_excerpt: string;
        }>;
        const bullets = evRows.map((r) => {
          const sum = truncateWithEllipsis(String(r.content_summary ?? ''), 220);
          const ex = truncateWithEllipsis(String(r.content_text_or_excerpt ?? ''), 420);
          return ex ? `${sum} — ${ex}` : sum;
        });
        if (bullets.length > 0) {
          const userPrompt = buildUserPrompt({
            uiLang,
            clusterLabel,
            changePolicy: String(changePolicy),
            evidenceBullets: bullets,
          });
          const summaries = await fetchLlmSummariesOpenAiCompatible(
            {
              apiKey: appCfg.llmApiKey,
              baseUrl: appCfg.llmBaseUrl,
              model: appCfg.llmModel,
              useJsonObjectResponseFormat: appCfg.llmJsonObjectResponseFormat,
            },
            userPrompt,
          );
          decisionSignals = mergeLlmSummariesIntoDecisionSignals(decisionSignals, summaries);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[pih] openai_compatible signal extraction failed; using placeholder summaries', e);
      }
    }

    if (mockMode) {
      applyMockExtractorOverlay(decisionSignals);
    }

    const validated = DecisionSignalsSchema.safeParse(decisionSignals);
    if (!validated.success) {
      throw new Error(`decision_signals_schema_invalid: ${validated.error.message}`);
    }

    const ds = validated.data;
    const claimHash = computeClaimTextHashFromDecisionSignals(ds);
    const conflictStrength = computeConflictStrengthFromDisagreement(ds.disagreement);
    const evidenceRefIdsJson = JSON.stringify(evidenceRefIdsSorted);

    let claimEmbeddingJson: string | null = null;
    let newEmbeddingVec: number[] | null = null;
    if (appCfg.claimEmbeddingEnabled && appCfg.llmApiKey) {
      try {
        const claimText = buildClaimTextFromDecisionSignals(ds);
        newEmbeddingVec = await fetchClaimEmbeddingOpenAiCompatible(
          {
            apiKey: appCfg.llmApiKey,
            baseUrl: appCfg.llmBaseUrl,
            model: appCfg.embeddingModel,
          },
          claimText,
        );
        claimEmbeddingJson = JSON.stringify(newEmbeddingVec);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[pih] claim embedding failed; using hash-only conclusion delta', e);
      }
    }

    const oldEmb = parseEmbeddingJson(prev?.claim_embedding_json ?? null);
    const conclusionDeltaForKind =
      oldEmb && newEmbeddingVec && oldEmb.length === newEmbeddingVec.length
        ? computeConclusionDeltaFromEmbeddings(oldEmb, newEmbeddingVec)
        : computeConclusionDeltaFromClaimHashes(prev?.claim_text_hash ?? null, claimHash);

    const conflictDeltaForKind = computeConflictDelta(prev?.conflict_strength ?? null, conflictStrength);
    const evidence_changed = Boolean(prev && prev.evidence_set_hash !== evidenceSetHash);
    // No prior timeline row: establish baseline as topic_drift (avoids treating "first claim" as event_update for push noise).
    const cluster_kind = !prev
      ? 'topic_drift'
      : clusterKindFromSignals({
          evidence_changed,
          conclusion_delta: conclusionDeltaForKind,
          conflict_delta: conflictDeltaForKind,
        });

    stmtUpsertTimeline.run(
      roundId,
      c.cluster_id,
      evidenceSetHash,
      cluster_kind,
      evidenceRefIdsJson,
      claimHash,
      conflictStrength,
      claimEmbeddingJson,
    );

    stmtUpsert.run(
      decisionSignals.cluster_id,
      decisionSignals.signal_schema_version,
      decisionSignals.change_policy_used,
      JSON.stringify(decisionSignals),
    );
  }
}
