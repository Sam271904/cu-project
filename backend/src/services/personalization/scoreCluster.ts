import type { PersonalizationProfile, PersonalizationScore } from './types';

function velocityScore(velocity: number): number {
  // sigmoid(velocity / 10) → [0, 1]
  return 1 / (1 + Math.exp(-velocity / 10));
}

function positionScore(position: number): number {
  // position 1 → 1.0, position 100 → 0, clamped
  return Math.max(0, Math.min(1, 1 - position / 100));
}

export function computeHnSignal(velocity: number | null, position: number): number | null {
  if (velocity === null && position > 100) return null; // no signal if not in top 100
  const vScore = velocity !== null ? velocityScore(velocity) : 0.5;
  const pScore = positionScore(position);
  return vScore * 0.6 + pScore * 0.4;
}

/**
 * Deterministic v1 scoring: deny filter, allow/persona boosts, feedback nudges.
 */
function computeFeedbackDecay(updatedAtUtc?: string): number {
  if (!updatedAtUtc) return 1;
  const ts = new Date(updatedAtUtc).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 1;
  const ageDays = Math.max(0, (Date.now() - ts) / 86_400_000);
  const halfLifeDays = 14;
  const decay = Math.exp((-Math.log(2) * ageDays) / halfLifeDays);
  return Math.max(0.15, Math.min(1, decay));
}

export function scoreClusterForPersonalization(
  input: {
    cluster_id: string;
    content_summary: string;
    snippet_text: string;
    tags: string[];
    extra_text?: string;
    hn_signal?: number | null;
  },
  profile: PersonalizationProfile,
): PersonalizationScore {
  const tagsLower = input.tags.map((t) => String(t).toLowerCase());
  const text = [
    input.content_summary,
    input.snippet_text,
    tagsLower.join(' '),
    input.extra_text ?? '',
  ]
    .join('\n')
    .toLowerCase();

  for (const d of profile.deny) {
    if (d && text.includes(d)) {
      return { score: -1e9, reasons: [`deny:${d}`], denied: true };
    }
  }

  let score = 0;
  const reasons: string[] = [];

  for (const a of profile.allow) {
    if (a && text.includes(a)) {
      score += 0.12;
      reasons.push(`allow:${a}`);
    }
  }

  for (const p of profile.personas) {
    const hit = p.keywords.some((k) => k && text.includes(k));
    if (hit) {
      score += 0.18 * p.weight;
      reasons.push(`persona:${p.name}`);
    }
  }

  const fb = profile.feedback[input.cluster_id];
  if (fb) {
    const decay = computeFeedbackDecay(fb.updated_at_utc);
    if (fb.sentiment === 1) {
      score += 0.25 * decay;
      reasons.push(`feedback:like:${decay.toFixed(2)}`);
    }
    if (fb.sentiment === -1) {
      score -= 0.25 * decay;
      reasons.push(`feedback:dislike:${decay.toFixed(2)}`);
    }
    if (fb.saved) {
      score += 0.08 * decay;
      reasons.push(`feedback:saved:${decay.toFixed(2)}`);
    }
  }

  // Blend HN signal at the end (HN_WEIGHT = 15% of final score)
  const HN_WEIGHT = 0.15;
  let hn_signal: number | null = null;
  if (input.hn_signal != null) {
    hn_signal = input.hn_signal;
    score = score * (1 - HN_WEIGHT) + hn_signal * HN_WEIGHT;
    reasons.push(`hn:${hn_signal.toFixed(3)}`);
  }

  return { score, reasons, denied: false, hn_signal };
}
