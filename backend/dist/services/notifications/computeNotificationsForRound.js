"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAndStoreNotificationsForRound = computeAndStoreNotificationsForRound;
const buildPushPayload_1 = require("./buildPushPayload");
const USER_ID = 'local-user';
const SIGNAL_SCHEMA_VERSION = 'v1-signals-0';
function scoreToReminderLevel(score) {
    if (score >= 0.8)
        return 'high';
    if (score >= 0.5)
        return 'medium';
    return null;
}
async function computeAndStoreNotificationsForRound(db, roundId, nowUtcIso) {
    const clusterRows = db
        .prepare(`
      SELECT DISTINCT ds.cluster_id
      FROM decision_signals ds
      JOIN cluster_evidence ce ON ce.cluster_id = ds.cluster_id
      JOIN normalized_items n ON n.id = ce.normalized_item_id
      WHERE n.collection_round_id = ?
      ORDER BY ds.cluster_id ASC
      `)
        .all(roundId);
    const clusterIds = clusterRows.map((r) => r.cluster_id);
    const stmtGetPrev = db.prepare(`
    SELECT 1
    FROM notification_event_log
    WHERE user_id = ?
      AND event_key = ?
      AND signal_fingerprint = ?
      AND created_at_utc >= datetime(?, '-7 days')
    LIMIT 1
    `);
    const stmtInsert = db.prepare(`
    INSERT INTO notification_event_log (user_id, event_key, reminder_level, signal_fingerprint, payload_json, status)
    VALUES (?, ?, ?, ?, ?, 'queued')
    `);
    const highIds = [];
    const mediumIds = [];
    const stmtLoad = db.prepare('SELECT signal_schema_version, signals_json FROM decision_signals WHERE cluster_id = ?');
    for (const cluster_id of clusterIds) {
        const dsRow = stmtLoad.get(cluster_id);
        if (!dsRow)
            continue;
        if (dsRow.signal_schema_version !== SIGNAL_SCHEMA_VERSION)
            continue;
        const tl = db
            .prepare('SELECT cluster_kind FROM cluster_timeline_state WHERE collection_round_id = ? AND cluster_id = ?')
            .get(roundId, cluster_id);
        if (!tl)
            continue;
        if (tl.cluster_kind !== 'event_update')
            continue;
        const signal = JSON.parse(dsRow.signals_json);
        const signal_fingerprint = (0, buildPushPayload_1.signalFingerprintFromSignalsJson)(dsRow.signals_json, SIGNAL_SCHEMA_VERSION);
        const alreadySent = stmtGetPrev.get(USER_ID, cluster_id, signal_fingerprint, nowUtcIso) ? true : false;
        if (alreadySent)
            continue;
        // v1 change score: we treat event_update as evidence novelty present.
        // This is minimal but makes reminders depend on cross-round change.
        const evidence_novelty = 1;
        const conclusion_delta = 1;
        const conflict_delta = 0.5;
        const w1 = 0.4, w2 = 0.4, w3 = 0.2;
        const significant_change_score = w1 * evidence_novelty + w2 * conclusion_delta + w3 * conflict_delta;
        const reminder_level = scoreToReminderLevel(significant_change_score);
        if (!reminder_level)
            continue;
        // Payload short_summary must come only from structured summaries (v1).
        const change_summary = String(signal?.change?.change_summary ?? '');
        const title = `Key change (${reminder_level})`;
        const payload = (0, buildPushPayload_1.buildPushPayload)({
            event_key: cluster_id,
            reminder_level,
            title,
            short_summary_source: change_summary,
        });
        stmtInsert.run(USER_ID, cluster_id, reminder_level, signal_fingerprint, JSON.stringify(payload));
        if (reminder_level === 'high')
            highIds.push(cluster_id);
        else
            mediumIds.push(cluster_id);
    }
    return { high: highIds.length, medium: mediumIds.length };
}
