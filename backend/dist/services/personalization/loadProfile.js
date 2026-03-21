"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPersonalizationProfile = loadPersonalizationProfile;
function loadPersonalizationProfile(db) {
    const allowRows = db
        .prepare(`SELECT keyword FROM personalization_keyword_rules WHERE mode = 'allow'`)
        .all();
    const denyRows = db
        .prepare(`SELECT keyword FROM personalization_keyword_rules WHERE mode = 'deny'`)
        .all();
    const personaRows = db
        .prepare(`SELECT name, keywords_json, weight FROM personalization_personas`)
        .all();
    const fbRows = db
        .prepare(`SELECT cluster_id, sentiment, saved FROM personalization_feedback`)
        .all();
    const feedback = {};
    for (const r of fbRows) {
        feedback[r.cluster_id] = { sentiment: r.sentiment, saved: Boolean(r.saved) };
    }
    return {
        allow: allowRows.map((r) => String(r.keyword).toLowerCase().trim()).filter(Boolean),
        deny: denyRows.map((r) => String(r.keyword).toLowerCase().trim()).filter(Boolean),
        personas: personaRows.map((r) => {
            let keywords = [];
            try {
                const parsed = JSON.parse(r.keywords_json || '[]');
                if (Array.isArray(parsed)) {
                    keywords = parsed.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
                }
            }
            catch {
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
