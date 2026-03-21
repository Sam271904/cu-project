"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClusterSchema = exports.DecisionSignalsSchema = exports.ChangePolicySchema = exports.EvidenceLinkSchema = exports.EvidenceRefSchema = exports.EvidenceSnippetSchema = exports.add = void 0;
exports.clusterId = clusterId;
exports.evidenceRefId = evidenceRefId;
exports.disagreementStructHash = disagreementStructHash;
exports.signalFingerprint = signalFingerprint;
exports.eventKey = eventKey;
var util_1 = require("./util");
Object.defineProperty(exports, "add", { enumerable: true, get: function () { return util_1.add; } });
var evidence_1 = require("./schemas/evidence");
Object.defineProperty(exports, "EvidenceSnippetSchema", { enumerable: true, get: function () { return evidence_1.EvidenceSnippetSchema; } });
Object.defineProperty(exports, "EvidenceRefSchema", { enumerable: true, get: function () { return evidence_1.EvidenceRefSchema; } });
Object.defineProperty(exports, "EvidenceLinkSchema", { enumerable: true, get: function () { return evidence_1.EvidenceLinkSchema; } });
var signals_1 = require("./schemas/signals");
Object.defineProperty(exports, "ChangePolicySchema", { enumerable: true, get: function () { return signals_1.ChangePolicySchema; } });
Object.defineProperty(exports, "DecisionSignalsSchema", { enumerable: true, get: function () { return signals_1.DecisionSignalsSchema; } });
var cluster_1 = require("./schemas/cluster");
Object.defineProperty(exports, "ClusterSchema", { enumerable: true, get: function () { return cluster_1.ClusterSchema; } });
const node_crypto_1 = require("node:crypto");
function sha256Hex(input) {
    return (0, node_crypto_1.createHash)('sha256').update(input, 'utf8').digest('hex');
}
// Task 1.2 deterministic identifiers
function clusterId(canonical_signature, clustering_model_version) {
    return sha256Hex(`${canonical_signature}|${clustering_model_version}`);
}
function evidenceRefId(normalized_item_id, extractor_version) {
    // Spec: evidence_ref_id = normalized_item_id + "|" + extractor_version
    return `${normalized_item_id}|${extractor_version}`;
}
function disagreementStructHash(risk_summary, opportunity_summary, dispute_summary, sides, coverage_gaps) {
    const sidesPart = sides.join(',');
    const coverageGapsPart = coverage_gaps.join(',');
    return sha256Hex([risk_summary, opportunity_summary, dispute_summary, sidesPart, coverageGapsPart].join('|'));
}
function signalFingerprint(signal_schema_version, change_type, evidence_ref_ids, change_policy_used, disagreementRiskOppStructHash) {
    const sortedEvidenceRefIds = [...evidence_ref_ids].sort();
    return sha256Hex([
        signal_schema_version,
        change_type,
        sortedEvidenceRefIds.join(','),
        change_policy_used,
        disagreementRiskOppStructHash,
    ].join('|'));
}
function eventKey(representative_cluster_id) {
    return String(representative_cluster_id);
}
