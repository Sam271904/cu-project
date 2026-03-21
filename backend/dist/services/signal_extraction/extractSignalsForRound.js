"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSignalsForRound = extractSignalsForRound;
const node_crypto_1 = __importDefault(require("node:crypto"));
const shared_1 = require("@e-cu/shared");
const config_1 = require("../../config");
const changePolicyResolver_1 = require("./changePolicyResolver");
const decisionSignalsBuilder_1 = require("./decisionSignalsBuilder");
const signalExtractorMode_1 = require("./signalExtractorMode");
function sha256Hex(input) {
    return node_crypto_1.default.createHash('sha256').update(input).digest('hex');
}
async function extractSignalsForRound(db, roundId, uiLang = 'en', opts) {
    const clusters = db
        .prepare(`
      SELECT DISTINCT c.cluster_id
      FROM clusters c
      JOIN cluster_evidence ce ON ce.cluster_id = c.cluster_id
      JOIN normalized_items n ON n.id = ce.normalized_item_id
      WHERE n.collection_round_id = ?
      ORDER BY c.cluster_id ASC
      `)
        .all(roundId);
    const stmtUpsert = db.prepare(`
    INSERT OR REPLACE INTO decision_signals (cluster_id, signal_schema_version, change_policy_used, signals_json)
    VALUES (?, ?, ?, ?)
    `);
    const stmtFirstEvidence = db.prepare(`
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
    `);
    const stmtEvidenceExternalIds = db.prepare(`
    SELECT
      n.external_id as external_id
    FROM normalized_items n
    JOIN cluster_evidence ce ON ce.normalized_item_id = n.id
    WHERE ce.cluster_id = ? AND n.collection_round_id = ?
    ORDER BY n.id ASC
    `);
    const stmtDistinctSourceTypes = db.prepare(`
    SELECT DISTINCT n.source_type AS source_type
    FROM normalized_items n
    JOIN cluster_evidence ce ON ce.normalized_item_id = n.id
    WHERE ce.cluster_id = ? AND n.collection_round_id = ?
    ORDER BY n.source_type ASC
    `);
    const stmtPrevTimeline = db.prepare(`
    SELECT evidence_set_hash, cluster_kind
    FROM cluster_timeline_state
    WHERE cluster_id = ? AND collection_round_id < ?
    ORDER BY collection_round_id DESC
    LIMIT 1
    `);
    const stmtUpsertTimeline = db.prepare(`
    INSERT OR REPLACE INTO cluster_timeline_state
      (collection_round_id, cluster_id, evidence_set_hash, cluster_kind)
    VALUES
      (?, ?, ?, ?)
    `);
    const mockMode = opts?.forceMockOverlay === true || (0, signalExtractorMode_1.isMockSignalExtractor)();
    const { changePolicyOverride } = (0, config_1.loadAppConfig)();
    for (const c of clusters) {
        const evidenceRow = stmtFirstEvidence.get(c.cluster_id, roundId);
        if (!evidenceRow)
            continue;
        const evidenceExternalRows = stmtEvidenceExternalIds.all(c.cluster_id, roundId);
        const evidenceExternalIds = evidenceExternalRows.map((r) => r.external_id);
        const evidenceRefIds = evidenceExternalIds.map((extId) => `${extId}|${decisionSignalsBuilder_1.EVIDENCE_EXTRACTOR_VERSION}`);
        const evidenceRefIdsSorted = [...evidenceRefIds].sort();
        const evidenceSetHash = sha256Hex(evidenceRefIdsSorted.join(','));
        const evidenceCount = evidenceExternalIds.length;
        const prev = stmtPrevTimeline.get(c.cluster_id, roundId);
        const isChanged = prev ? prev.evidence_set_hash !== evidenceSetHash : false;
        const cluster_kind = isChanged ? 'event_update' : 'topic_drift';
        const evidence_links = (0, decisionSignalsBuilder_1.buildEvidenceLinksFromNormalizedRow)({
            ...evidenceRow,
            url: String(evidenceRow.url ?? ''),
        });
        const clusterLabel = typeof evidenceRow.content_summary === 'string' && String(evidenceRow.content_summary).trim()
            ? String(evidenceRow.content_summary).trim()
            : `cluster_${c.cluster_id.slice(0, 8)}`;
        stmtUpsertTimeline.run(roundId, c.cluster_id, evidenceSetHash, cluster_kind);
        const sourceTypeRows = stmtDistinctSourceTypes.all(c.cluster_id, roundId);
        const changePolicy = (0, changePolicyResolver_1.resolveChangePolicyFromSourceTypes)(sourceTypeRows.map((r) => r.source_type), changePolicyOverride);
        let decisionSignals = (0, decisionSignalsBuilder_1.buildPlaceholderDecisionSignals)({
            clusterId: c.cluster_id,
            evidence_links,
            uiLang,
            evidenceCount,
            clusterLabel,
            changePolicy,
        });
        if (mockMode) {
            (0, decisionSignalsBuilder_1.applyMockExtractorOverlay)(decisionSignals);
        }
        const validated = shared_1.DecisionSignalsSchema.safeParse(decisionSignals);
        if (!validated.success) {
            throw new Error(`decision_signals_schema_invalid: ${validated.error.message}`);
        }
        stmtUpsert.run(decisionSignals.cluster_id, decisionSignals.signal_schema_version, decisionSignals.change_policy_used, JSON.stringify(decisionSignals));
    }
}
