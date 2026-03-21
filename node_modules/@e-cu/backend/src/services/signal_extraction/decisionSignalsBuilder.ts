import { truncateWithEllipsis } from '../normalize/normalizeText';

export type EvidenceSnippet = {
  snippet_text: string;
  snippet_language: string;
  extractor_version: string;
};

export type EvidenceRef = {
  normalized_item_id: string;
  url: string;
  published_at: string;
  extractor_version: string;
  confidence: number;
  extracted_spans: Array<{ start_char: number; end_char: number; span_type: string; confidence: number }>;
};

export type EvidenceLink = {
  evidence_ref: EvidenceRef;
  evidence_snippet?: EvidenceSnippet;
  role: 'supports' | 'contradicts' | 'context';
  link_confidence: number;
};

export type DecisionSignalsPayload = {
  cluster_id: string;
  signal_schema_version: string;
  change_policy_used: 'LATEST_WINS' | 'EVIDENCE_WEIGHTED' | 'SOURCE_TRUSTED' | 'USER_OVERRIDE';
  change: {
    evidence_links: EvidenceLink[];
    change_policy_used: DecisionSignalsPayload['change_policy_used'];
    change_summary: string;
    change_type: 'added' | 'corrected' | 'inverted' | 'supplemented' | 'unknown';
  };
  risk: {
    evidence_links: EvidenceLink[];
    change_policy_used: DecisionSignalsPayload['change_policy_used'];
    risk_summary: string;
  };
  opportunity: {
    evidence_links: EvidenceLink[];
    change_policy_used: DecisionSignalsPayload['change_policy_used'];
    opportunity_summary: string;
  };
  disagreement: {
    evidence_links: EvidenceLink[];
    change_policy_used: DecisionSignalsPayload['change_policy_used'];
    dispute_summary: string;
    sides: string[];
    coverage_gaps: string[];
  };
};

export const SIGNAL_SCHEMA_VERSION = 'v1-signals-0';
export const CHANGE_POLICY_USED: DecisionSignalsPayload['change_policy_used'] = 'LATEST_WINS';
export const EVIDENCE_EXTRACTOR_VERSION = 'v1-evidence-from-normalized-0';

export function buildEvidenceLinksFromNormalizedRow(normalizedRow: {
  normalized_item_id: number | string;
  content_text_or_excerpt: string;
  language: string;
  published_at?: string | null;
  collected_at?: string | null;
  collected_at_utc?: string | null;
  url: string;
}): EvidenceLink[] {
  const snippet_text = truncateWithEllipsis(String(normalizedRow.content_text_or_excerpt ?? ''), 600);
  const snippet_language = String(normalizedRow.language ?? 'en');
  const published_at =
    normalizedRow.published_at ?? normalizedRow.collected_at ?? normalizedRow.collected_at_utc ?? '';
  const url = String(normalizedRow.url ?? '');
  const normalized_item_id = String(normalizedRow.normalized_item_id);

  const evidenceSnippet: EvidenceSnippet = {
    snippet_text,
    snippet_language,
    extractor_version: EVIDENCE_EXTRACTOR_VERSION,
  };

  const evidenceRef: EvidenceRef = {
    normalized_item_id,
    url,
    published_at: String(published_at),
    extractor_version: EVIDENCE_EXTRACTOR_VERSION,
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

export type UiLang = 'zh' | 'en';

export function buildPlaceholderDecisionSignals(opts: {
  clusterId: string;
  evidence_links: EvidenceLink[];
  uiLang: UiLang;
  evidenceCount: number;
  clusterLabel: string;
  /** Task 6.2: truth policy C — from env override or `source_type` heuristic */
  changePolicy?: DecisionSignalsPayload['change_policy_used'];
}): DecisionSignalsPayload {
  const { clusterId, evidence_links, uiLang, evidenceCount, clusterLabel } = opts;
  const policy = opts.changePolicy ?? CHANGE_POLICY_USED;
  const changeSummary =
    uiLang === 'zh'
      ? `证据更新（${evidenceCount} 条）：${clusterLabel}`
      : `Evidence updated (${evidenceCount} items): ${clusterLabel}`;
  const riskSummary =
    uiLang === 'zh'
      ? `风险：与 ${clusterLabel} 相关的潜在不利因素`
      : `Risk: potential downsides related to ${clusterLabel}`;
  const oppSummary =
    uiLang === 'zh'
      ? `机会：可围绕 ${clusterLabel} 探索可执行动作`
      : `Opportunity: explore actions tied to ${clusterLabel}`;
  const disputeSummary =
    uiLang === 'zh'
      ? `分歧：关于 ${clusterLabel} 存在不同观点`
      : `Disagreement: differing viewpoints about ${clusterLabel}`;
  const coverageGap =
    uiLang === 'zh' ? '需要更多证据以降低不确定性' : 'Need more evidence to reduce uncertainty';

  return {
    cluster_id: clusterId,
    signal_schema_version: SIGNAL_SCHEMA_VERSION,
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
export function applyMockExtractorOverlay(signals: DecisionSignalsPayload): void {
  const tag = '[mock_llm]';
  signals.change.change_summary = `${tag} ${signals.change.change_summary}`;
  signals.risk.risk_summary = `${tag} ${signals.risk.risk_summary}`;
  signals.opportunity.opportunity_summary = `${tag} ${signals.opportunity.opportunity_summary}`;
  signals.disagreement.dispute_summary = `${tag} ${signals.disagreement.dispute_summary}`;
}
