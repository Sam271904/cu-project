import crypto from 'node:crypto';
import { DecisionSignalsSchema, disagreementStructHash, signalFingerprint } from '@e-cu/shared';
import type { DecisionSignals } from '@e-cu/shared';

import { buildClaimTextFromDecisionSignals } from '../signal_extraction/buildClaimText';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function collectEvidenceRefIdsFromDecisionSignals(ds: DecisionSignals): string[] {
  const out: string[] = [];
  const add = (links: DecisionSignals['change']['evidence_links']) => {
    for (const l of links) {
      const id = `${l.evidence_ref.normalized_item_id}|${l.evidence_ref.extractor_version}`;
      out.push(id);
    }
  };
  add(ds.change.evidence_links);
  add(ds.risk.evidence_links);
  add(ds.opportunity.evidence_links);
  add(ds.disagreement.evidence_links);
  return [...new Set(out)].sort();
}

/** Deterministic fingerprint per design (Task 8.2): evidence refs + struct hash + policy + change_type. */
export function computeSignalFingerprintFromSignalsJson(signals_json: string): string {
  const parsed = JSON.parse(signals_json) as unknown;
  const ds = DecisionSignalsSchema.parse(parsed);
  return computeSignalFingerprintFromDecisionSignals(ds);
}

export function computeSignalFingerprintFromDecisionSignals(ds: DecisionSignals): string {
  const evidence_ref_ids = collectEvidenceRefIdsFromDecisionSignals(ds);
  const structHash = disagreementStructHash(
    ds.risk.risk_summary,
    ds.opportunity.opportunity_summary,
    ds.disagreement.dispute_summary,
    ds.disagreement.sides,
    ds.disagreement.coverage_gaps,
  );
  return signalFingerprint(
    ds.signal_schema_version,
    ds.change.change_type,
    evidence_ref_ids,
    ds.change_policy_used,
    structHash,
  );
}

export function computeClaimTextHashFromDecisionSignals(ds: DecisionSignals): string {
  const claim = buildClaimTextFromDecisionSignals({
    change: { change_summary: ds.change.change_summary },
    risk: { risk_summary: ds.risk.risk_summary },
    opportunity: { opportunity_summary: ds.opportunity.opportunity_summary },
    disagreement: {
      dispute_summary: ds.disagreement.dispute_summary,
      sides: ds.disagreement.sides,
      coverage_gaps: ds.disagreement.coverage_gaps,
    },
  });
  return sha256Hex(claim);
}
