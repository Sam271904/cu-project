/**
 * v1 deterministic claim text for embeddings / change scoring (design spec).
 * MUST NOT include EvidenceSnippet.snippet_text — only structured summaries.
 *
 * claim_text =
 *   "CHANGE:" + change_summary
 *   + "||RISK:" + risk_summary
 *   + "||OPP:" + opportunity_summary
 *   + "||DISPUTE:" + dispute_summary
 *   + "||SIDES:" + sides.join(",")
 *   + "||GAPS:" + coverage_gaps.join(",")
 */
export type ClaimTextSignalInput = {
  change: { change_summary: string };
  risk: { risk_summary: string };
  opportunity: { opportunity_summary: string };
  disagreement: {
    dispute_summary: string;
    sides: readonly string[];
    coverage_gaps: readonly string[];
  };
};

export function buildClaimTextFromDecisionSignals(signals: ClaimTextSignalInput): string {
  const sides = signals.disagreement.sides.map((s) => String(s));
  const gaps = signals.disagreement.coverage_gaps.map((s) => String(s));
  return [
    'CHANGE:',
    signals.change.change_summary,
    '||RISK:',
    signals.risk.risk_summary,
    '||OPP:',
    signals.opportunity.opportunity_summary,
    '||DISPUTE:',
    signals.disagreement.dispute_summary,
    '||SIDES:',
    sides.join(','),
    '||GAPS:',
    gaps.join(','),
  ].join('');
}
