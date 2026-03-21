import type { PersonalizationProfile, PersonalizationScore } from './types';

/**
 * Deterministic v1 scoring: deny filter, allow/persona boosts, feedback nudges.
 */
export function scoreClusterForPersonalization(
  input: {
    cluster_id: string;
    content_summary: string;
    snippet_text: string;
    tags: string[];
    extra_text?: string;
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
    if (fb.sentiment === 1) {
      score += 0.25;
      reasons.push('feedback:like');
    }
    if (fb.sentiment === -1) {
      score -= 0.25;
      reasons.push('feedback:dislike');
    }
    if (fb.saved) {
      score += 0.08;
      reasons.push('saved');
    }
  }

  return { score, reasons, denied: false };
}
