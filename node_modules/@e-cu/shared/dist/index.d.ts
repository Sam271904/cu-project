export { add } from './util';
export { EvidenceSnippetSchema, EvidenceRefSchema, EvidenceLinkSchema, } from './schemas/evidence';
export { ChangePolicySchema, DecisionSignalsSchema } from './schemas/signals';
export { ClusterSchema } from './schemas/cluster';
export type { EvidenceSnippet, EvidenceRef, EvidenceLink, DecisionSignals, Cluster, ChangePolicy, ChangeType, ChangeSignal, RiskSignal, OpportunitySignal, DisagreementSignal, ClusterKind, } from './types';
import type { ChangePolicy, ChangeType } from './schemas/signals';
export declare function clusterId(canonical_signature: string, clustering_model_version: string): string;
export declare function evidenceRefId(normalized_item_id: string, extractor_version: string): string;
export declare function disagreementStructHash(risk_summary: string, opportunity_summary: string, dispute_summary: string, sides: readonly string[], coverage_gaps: readonly string[]): string;
export declare function signalFingerprint(signal_schema_version: string, change_type: ChangeType, evidence_ref_ids: readonly string[], change_policy_used: ChangePolicy, disagreementRiskOppStructHash: string): string;
export declare function eventKey(representative_cluster_id: string): string;
//# sourceMappingURL=index.d.ts.map