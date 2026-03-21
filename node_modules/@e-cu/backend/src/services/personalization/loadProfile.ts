import type Database from 'better-sqlite3';

import type { PersonalizationProfile } from './types';

export function loadPersonalizationProfile(db: Database.Database): PersonalizationProfile {
  const allowRows = db
    .prepare(`SELECT keyword FROM personalization_keyword_rules WHERE mode = 'allow'`)
    .all() as Array<{ keyword: string }>;
  const denyRows = db
    .prepare(`SELECT keyword FROM personalization_keyword_rules WHERE mode = 'deny'`)
    .all() as Array<{ keyword: string }>;
  const personaRows = db
    .prepare(`SELECT name, keywords_json, weight FROM personalization_personas`)
    .all() as Array<{ name: string; keywords_json: string; weight: number }>;
  const fbRows = db
    .prepare(`SELECT cluster_id, sentiment, saved FROM personalization_feedback`)
    .all() as Array<{ cluster_id: string; sentiment: number; saved: number }>;

  const feedback: PersonalizationProfile['feedback'] = {};
  for (const r of fbRows) {
    feedback[r.cluster_id] = { sentiment: r.sentiment, saved: Boolean(r.saved) };
  }

  return {
    allow: allowRows.map((r) => String(r.keyword).toLowerCase().trim()).filter(Boolean),
    deny: denyRows.map((r) => String(r.keyword).toLowerCase().trim()).filter(Boolean),
    personas: personaRows.map((r) => {
      let keywords: string[] = [];
      try {
        const parsed = JSON.parse(r.keywords_json || '[]');
        if (Array.isArray(parsed)) {
          keywords = parsed.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
        }
      } catch {
        keywords = [];
      }
      return {
        name: String(r.name).trim() || 'persona',
        keywords,
        weight: typeof r.weight === 'number' && Number.isFinite(r.weight) ? r.weight : 1,
      };
    }),
    feedback,
  };
}
