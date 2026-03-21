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

export function computeSignificantChangeScore(
  evidence_novelty: number,
  conclusion_delta: number,
  conflict_delta: number,
  weights: { w1: number; w2: number; w3: number } = DEFAULT_REMINDER_WEIGHTS,
): number {
  const { w1, w2, w3 } = weights;
  return w1 * evidence_novelty + w2 * conclusion_delta + w3 * conflict_delta;
}

export function mapScoreToReminderLevel(score: number): ReminderLevel | null {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return null;
}

/** topic_drift push exception: high + w3*conflict_delta dominates w1*novelty and w2*conclusion */
export function topicDriftConflictDominates(
  evidence_novelty: number,
  conclusion_delta: number,
  conflict_delta: number,
  weights: { w1: number; w2: number; w3: number } = DEFAULT_REMINDER_WEIGHTS,
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
  weights?: { w1: number; w2: number; w3: number };
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
