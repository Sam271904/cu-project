import { jaccardSimilarity } from '../cluster/mergeUtils';

export type ReminderLevel = 'high' | 'medium';

/** Spec: evidence_novelty = 1 - Jaccard(old_evidence_refs, new_evidence_refs) */
export function computeEvidenceNovelty(oldRefIds: readonly string[], newRefIds: readonly string[]): number {
  const a = new Set(oldRefIds.map(String));
  const b = new Set(newRefIds.map(String));
  return 1 - jaccardSimilarity(a, b);
}

/** v1 without embeddings: compare deterministic claim hashes (see buildClaimText). */
export function computeConclusionDeltaFromClaimHashes(oldHash: string | null, newHash: string): number {
  if (oldHash === null || oldHash === '') return 1;
  return oldHash === newHash ? 0 : 1;
}

/** Cosine similarity in [-1,1] for equal-length vectors. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

/**
 * Design: conclusion_delta = 1 - cosine_sim(claim_embedding_old, claim_embedding_new), in [0,1].
 * Missing or mismatched dims → treat as full change (1).
 */
export function computeConclusionDeltaFromEmbeddings(oldVec: readonly number[] | null, newVec: readonly number[] | null): number {
  if (!newVec || newVec.length === 0) return 1;
  if (!oldVec || oldVec.length === 0) return 1;
  if (oldVec.length !== newVec.length) return 1;
  const cos = cosineSimilarity(oldVec, newVec);
  return Math.min(1, Math.max(0, 1 - cos));
}

/** Spec: contradict_conf / (contradict_conf + support_conf + 1e-9) */
export function computeConflictStrengthFromDisagreement(disagreement: {
  evidence_links: ReadonlyArray<{ role: string; link_confidence: number }>;
}): number {
  let contradict = 0;
  let support = 0;
  for (const link of disagreement.evidence_links ?? []) {
    if (link.role === 'contradicts') contradict += Number(link.link_confidence) || 0;
    if (link.role === 'supports') support += Number(link.link_confidence) || 0;
  }
  return contradict / (contradict + support + 1e-9);
}

/** Spec: clamp(strength_new - strength_old, 0, 1) */
export function computeConflictDelta(oldStrength: number | null, newStrength: number): number {
  const oldS = oldStrength ?? 0;
  const d = newStrength - oldS;
  return Math.min(1, Math.max(0, d));
}

export const DEFAULT_REMINDER_WEIGHTS = { w1: 0.4, w2: 0.4, w3: 0.2 } as const;

export type ReminderWeights = { w1: number; w2: number; w3: number };

export function computeSignificantChangeScore(
  evidence_novelty: number,
  conclusion_delta: number,
  conflict_delta: number,
  weights: ReminderWeights = DEFAULT_REMINDER_WEIGHTS,
): number {
  const { w1, w2, w3 } = weights;
  return w1 * evidence_novelty + w2 * conclusion_delta + w3 * conflict_delta;
}

export type ReminderThresholds = { highMin: number; mediumMin: number };

const DEFAULT_THRESHOLDS: ReminderThresholds = { highMin: 0.8, mediumMin: 0.5 };

/** Spec: high ≥ highMin (default 0.8), medium ∈ [mediumMin, highMin) (default medium 0.5). */
export function mapScoreToReminderLevel(
  score: number,
  thresholds: ReminderThresholds = DEFAULT_THRESHOLDS,
): ReminderLevel | null {
  const { highMin, mediumMin } = thresholds;
  if (score >= highMin) return 'high';
  if (score >= mediumMin) return 'medium';
  return null;
}

/** topic_drift push exception: high + w3*conflict_delta dominates w1*novelty and w2*conclusion */
export function topicDriftConflictDominates(
  evidence_novelty: number,
  conclusion_delta: number,
  conflict_delta: number,
  weights: ReminderWeights = DEFAULT_REMINDER_WEIGHTS,
): boolean {
  const { w1, w2, w3 } = weights;
  const w3c = w3 * conflict_delta;
  return w3c >= Math.max(w1 * evidence_novelty, w2 * conclusion_delta);
}

export function shouldQueueWebPushNotification(opts: {
  cluster_kind: 'event_update' | 'topic_drift';
  reminder_level: ReminderLevel | null;
  evidence_novelty: number;
  conclusion_delta: number;
  conflict_delta: number;
  weights?: ReminderWeights;
}): boolean {
  if (!opts.reminder_level) return false;
  const w = opts.weights ?? DEFAULT_REMINDER_WEIGHTS;
  if (opts.cluster_kind === 'event_update') return true;
  if (opts.reminder_level !== 'high') return false;
  return topicDriftConflictDominates(
    opts.evidence_novelty,
    opts.conclusion_delta,
    opts.conflict_delta,
    w,
  );
}
