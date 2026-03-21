"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVIDENCE_EXTRACTOR_VERSION = exports.CHANGE_POLICY_USED = exports.SIGNAL_SCHEMA_VERSION = void 0;
exports.buildEvidenceLinksFromNormalizedRow = buildEvidenceLinksFromNormalizedRow;
exports.buildPlaceholderDecisionSignals = buildPlaceholderDecisionSignals;
exports.applyMockExtractorOverlay = applyMockExtractorOverlay;
const normalizeText_1 = require("../normalize/normalizeText");
exports.SIGNAL_SCHEMA_VERSION = 'v1-signals-0';
exports.CHANGE_POLICY_USED = 'LATEST_WINS';
exports.EVIDENCE_EXTRACTOR_VERSION = 'v1-evidence-from-normalized-0';
function buildEvidenceLinksFromNormalizedRow(normalizedRow) {
    const snippet_text = (0, normalizeText_1.truncateWithEllipsis)(String(normalizedRow.content_text_or_excerpt ?? ''), 600);
    const snippet_language = String(normalizedRow.language ?? 'en');
    const published_at = normalizedRow.published_at ?? normalizedRow.collected_at ?? normalizedRow.collected_at_utc ?? '';
    const url = String(normalizedRow.url ?? '');
    const normalized_item_id = String(normalizedRow.normalized_item_id);
    const evidenceSnippet = {
        snippet_text,
        snippet_language,
        extractor_version: exports.EVIDENCE_EXTRACTOR_VERSION,
    };
    const evidenceRef = {
        normalized_item_id,
        url,
        published_at: String(published_at),
        extractor_version: exports.EVIDENCE_EXTRACTOR_VERSION,
        confidence: 0.9,
        extracted_spans: [],
    };
    return [
        {
            evidence_ref: evidenceRef,
            evidence_snippet: evidenceSnippet,
            role: 'supports',
            link_confidence: 0.9,
        },
    ];
}
function buildPlaceholderDecisionSignals(opts) {
    const { clusterId, evidence_links, uiLang, evidenceCount, clusterLabel } = opts;
    const policy = opts.changePolicy ?? exports.CHANGE_POLICY_USED;
    const changeSummary = uiLang === 'zh'
        ? `证据更新（${evidenceCount} 条）：${clusterLabel}`
        : `Evidence updated (${evidenceCount} items): ${clusterLabel}`;
    const riskSummary = uiLang === 'zh'
        ? `风险：与 ${clusterLabel} 相关的潜在不利因素`
        : `Risk: potential downsides related to ${clusterLabel}`;
    const oppSummary = uiLang === 'zh'
        ? `机会：可围绕 ${clusterLabel} 探索可执行动作`
        : `Opportunity: explore actions tied to ${clusterLabel}`;
    const disputeSummary = uiLang === 'zh'
        ? `分歧：关于 ${clusterLabel} 存在不同观点`
        : `Disagreement: differing viewpoints about ${clusterLabel}`;
    const coverageGap = uiLang === 'zh' ? '需要更多证据以降低不确定性' : 'Need more evidence to reduce uncertainty';
    return {
        cluster_id: clusterId,
        signal_schema_version: exports.SIGNAL_SCHEMA_VERSION,
        change_policy_used: policy,
        change: {
            evidence_links,
            change_policy_used: policy,
            change_summary: changeSummary,
            change_type: 'added',
        },
        risk: {
            evidence_links,
            change_policy_used: policy,
            risk_summary: riskSummary,
        },
        opportunity: {
            evidence_links,
            change_policy_used: policy,
            opportunity_summary: oppSummary,
        },
        disagreement: {
            evidence_links,
            change_policy_used: policy,
            dispute_summary: disputeSummary,
            sides: ['A', 'B'],
            coverage_gaps: [coverageGap],
        },
    };
}
/** Mock LLM path (Task 6.2): same evidence, summaries tagged for tests / future prompt pipeline. */
function applyMockExtractorOverlay(signals) {
    const tag = '[mock_llm]';
    signals.change.change_summary = `${tag} ${signals.change.change_summary}`;
    signals.risk.risk_summary = `${tag} ${signals.risk.risk_summary}`;
    signals.opportunity.opportunity_summary = `${tag} ${signals.opportunity.opportunity_summary}`;
    signals.disagreement.dispute_summary = `${tag} ${signals.disagreement.dispute_summary}`;
}
