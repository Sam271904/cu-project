"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isoWeekBucket = isoWeekBucket;
exports.canonicalSignatureForItem = canonicalSignatureForItem;
exports.clusterId = clusterId;
exports.clusterKindFromDeltas = clusterKindFromDeltas;
exports.resolveEvidenceRootClusterId = resolveEvidenceRootClusterId;
exports.clusterNormalizedItemsForRound = clusterNormalizedItemsForRound;
const node_crypto_1 = __importDefault(require("node:crypto"));
const mergeUtils_1 = require("./mergeUtils");
const splitClusters_1 = require("./splitClusters");
function isoWeekBucket(utcIso) {
    // ISO week number in UTC: bucket = YYYY-Www
    const d = new Date(utcIso);
    if (Number.isNaN(d.getTime()))
        throw new Error(`invalid utcIso: ${utcIso}`);
    // Move to Thursday of this week to derive ISO week-year.
    const tmp = new Date(d.getTime());
    const day = tmp.getUTCDay() || 7; // Sun=0 -> 7, Mon=1..Sat=6
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const isoYear = tmp.getUTCFullYear();
    const yearStart = Date.UTC(isoYear, 0, 1); // Jan 1 UTC
    const week = Math.ceil(((tmp.getTime() - yearStart) / 86400000 + 1) / 7);
    return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
function canonicalSignatureForItem({ created_at_utc, source_type, language, source_id, }) {
    // v1 deterministic signature: stable across evidence updates for the same source/week.
    return `${isoWeekBucket(created_at_utc)}|${source_type}|${language}|${source_id}`;
}
function clusterId(canonical_signature, clustering_model_version) {
    const input = `${canonical_signature}|${clustering_model_version}`;
    return node_crypto_1.default.createHash('sha256').update(input).digest('hex');
}
function clusterKindFromDeltas({ conclusion_delta, conflict_delta }) {
    if (conclusion_delta === undefined && conflict_delta === undefined)
        return 'topic_drift';
    if (conclusion_delta !== undefined && conclusion_delta >= 0.6)
        return 'event_update';
    if (conflict_delta !== undefined && conflict_delta >= 0.5)
        return 'event_update';
    return 'topic_drift';
}
/** Follow representative_cluster_id chain to storage root (evidence lives here). */
function resolveEvidenceRootClusterId(db, clusterId) {
    const seen = new Set();
    let cur = clusterId;
    for (;;) {
        if (seen.has(cur))
            return clusterId;
        seen.add(cur);
        const row = db
            .prepare(`SELECT cluster_id, representative_cluster_id FROM clusters WHERE cluster_id = ?`)
            .get(cur);
        if (!row)
            return cur;
        if (row.representative_cluster_id === row.cluster_id)
            return row.cluster_id;
        cur = row.representative_cluster_id;
    }
}
function listEvidenceRootClusterIds(db) {
    const rows = db
        .prepare(`
      SELECT cluster_id
      FROM clusters
      WHERE cluster_id = representative_cluster_id
      ORDER BY cluster_id ASC
      `)
        .all();
    return rows.map((r) => r.cluster_id);
}
function loadTokenUnionForRoot(db, rootId) {
    const rows = db
        .prepare(`
      SELECT n.content_summary
      FROM cluster_evidence ce
      JOIN normalized_items n ON n.id = ce.normalized_item_id
      WHERE ce.cluster_id = ?
      `)
        .all(rootId);
    const acc = new Set();
    for (const r of rows) {
        (0, mergeUtils_1.mergeUnionSets)(acc, (0, mergeUtils_1.tokenizeContentSummary)(r.content_summary));
    }
    return acc;
}
async function clusterNormalizedItemsForRound(db, roundId, _nowUtcIso) {
    const clustering_model_version = 'v1';
    const normalized = db
        .prepare(`
      SELECT
        id as normalized_item_id,
        created_at_utc,
        source_type,
        source_id,
        language,
        content_summary
      FROM normalized_items
      WHERE collection_round_id = ?
      ORDER BY id ASC
      `)
        .all(roundId);
    const insertCluster = db.prepare(`
    INSERT OR IGNORE INTO clusters
      (cluster_id, representative_cluster_id, created_at_utc, canonical_signature, clustering_model_version)
    VALUES
      (?, ?, ?, ?, ?)
    `);
    const insertEvidence = db.prepare(`
    INSERT OR IGNORE INTO cluster_evidence (cluster_id, normalized_item_id)
    VALUES
      (?, ?)
    `);
    /** In-memory union per evidence root for this process (speed + same-round updates). */
    const tokenUnionByRoot = new Map();
    function getUnion(rootId) {
        let u = tokenUnionByRoot.get(rootId);
        if (!u) {
            u = loadTokenUnionForRoot(db, rootId);
            tokenUnionByRoot.set(rootId, u);
        }
        return u;
    }
    for (const n of normalized) {
        const canonical_signature = canonicalSignatureForItem({
            created_at_utc: n.created_at_utc,
            source_type: n.source_type,
            language: n.language,
            source_id: n.source_id,
        });
        const cid = clusterId(canonical_signature, clustering_model_version);
        const existingRow = db
            .prepare(`SELECT representative_cluster_id FROM clusters WHERE cluster_id = ?`)
            .get(cid);
        if (existingRow) {
            const root = resolveEvidenceRootClusterId(db, cid);
            insertEvidence.run(root, n.normalized_item_id);
            (0, mergeUtils_1.mergeUnionSets)(getUnion(root), (0, mergeUtils_1.tokenizeContentSummary)(n.content_summary));
            continue;
        }
        const itemTokens = (0, mergeUtils_1.tokenizeContentSummary)(n.content_summary);
        let bestJ = 0;
        let bestRoot = null;
        for (const rootId of listEvidenceRootClusterIds(db)) {
            if (rootId === cid)
                continue;
            const union = getUnion(rootId);
            const j = (0, mergeUtils_1.jaccardSimilarity)(itemTokens, union);
            if (j > bestJ) {
                bestJ = j;
                bestRoot = rootId;
            }
        }
        // v1 MVP: merge into existing root when similarity exceeds threshold (no reparenting of older roots).
        const mergeInto = bestRoot !== null && bestJ > mergeUtils_1.MERGE_JACCARD_THRESHOLD ? bestRoot : cid;
        const rep = mergeInto;
        insertCluster.run(cid, rep, n.created_at_utc, canonical_signature, clustering_model_version);
        insertEvidence.run(rep, n.normalized_item_id);
        (0, mergeUtils_1.mergeUnionSets)(getUnion(rep), itemTokens);
    }
    (0, splitClusters_1.maybeSplitClustersAfterRound)(db, roundId, _nowUtcIso);
}
