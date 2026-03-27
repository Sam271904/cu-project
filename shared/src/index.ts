export { add } from './util';

export {
  EvidenceSnippetSchema,
  EvidenceRefSchema,
  EvidenceLinkSchema,
} from './schemas/evidence';
export { ChangePolicySchema, DecisionSignalsSchema } from './schemas/signals';
export { ClusterSchema } from './schemas/cluster';

export type {
  EvidenceSnippet,
  EvidenceRef,
  EvidenceLink,
  DecisionSignals,
  Cluster,
  ChangePolicy,
  ChangeType,
  ChangeSignal,
  RiskSignal,
  OpportunitySignal,
  DisagreementSignal,
  ClusterKind,
} from './types';

import { createHash } from 'node:crypto';
import type { ChangePolicy, ChangeType } from './schemas/signals';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// Task 1.2 deterministic identifiers
export function clusterId(canonical_signature: string, clustering_model_version: string): string {
  return sha256Hex(`${canonical_signature}|${clustering_model_version}`);
}

export function evidenceRefId(normalized_item_id: string, extractor_version: string): string {
  // Spec: evidence_ref_id = normalized_item_id + "|" + extractor_version
  return `${normalized_item_id}|${extractor_version}`;
}

export function disagreementStructHash(
  risk_summary: string,
  opportunity_summary: string,
  dispute_summary: string,
  sides: readonly string[],
  coverage_gaps: readonly string[],
): string {
  const sidesPart = sides.join(',');
  const coverageGapsPart = coverage_gaps.join(',');
  return sha256Hex(
    [risk_summary, opportunity_summary, dispute_summary, sidesPart, coverageGapsPart].join('|'),
  );
}

export function signalFingerprint(
  signal_schema_version: string,
  change_type: ChangeType,
  evidence_ref_ids: readonly string[],
  change_policy_used: ChangePolicy,
  disagreementRiskOppStructHash: string,
): string {
  const sortedEvidenceRefIds = [...evidence_ref_ids].sort();
  return sha256Hex(
    [
      signal_schema_version,
      change_type,
      sortedEvidenceRefIds.join(','),
      change_policy_used,
      disagreementRiskOppStructHash,
    ].join('|'),
  );
}

export function eventKey(representative_cluster_id: string): string {
  return String(representative_cluster_id);
}


