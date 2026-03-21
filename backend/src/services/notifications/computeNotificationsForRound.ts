import type Database from 'better-sqlite3';

import { loadAppConfig } from '../../config';
import { resolveEvidenceRootClusterId } from '../cluster/clusterNormalizedItemsForRound';
import { computeSignalFingerprintFromSignalsJson } from './decisionSignalsFingerprint';
import { buildPushPayload } from './buildPushPayload';
import {
  computeConflictDelta,
  computeConclusionDeltaFromClaimHashes,
  computeEvidenceNovelty,
  computeSignificantChangeScore,
  mapScoreToReminderLevel,
  shouldQueueWebPushNotification,
} from './reminderScoring';

const USER_ID = 'local-user';
const SIGNAL_SCHEMA_VERSION = 'v1-signals-0';

function parseRefIdsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export async function computeAndStoreNotificationsForRound(
  db: Database.Database,
  roundId: number,
  nowUtcIso: string,
): Promise<{ high: number; medium: number }> {
  const clusterRows: Array<{ cluster_id: string }> = db
    .prepare(
      `
      SELECT DISTINCT ds.cluster_id
      FROM decision_signals ds
      JOIN cluster_evidence ce ON ce.cluster_id = ds.cluster_id
      JOIN normalized_items n ON n.id = ce.normalized_item_id
      WHERE n.collection_round_id = ?
      ORDER BY ds.cluster_id ASC
      `,
    )
    .all(roundId) as Array<{ cluster_id: string }>;

  const stmtLoad = db.prepare('SELECT signal_schema_version, signals_json FROM decision_signals WHERE cluster_id = ?');

  const stmtCurrentTimeline = db.prepare(
    `
    SELECT evidence_ref_ids_json, claim_text_hash, conflict_strength, cluster_kind
    FROM cluster_timeline_state
    WHERE collection_round_id = ? AND cluster_id = ?
    `,
  );

  const stmtPrevTimeline = db.prepare(
    `
    SELECT evidence_ref_ids_json, claim_text_hash, conflict_strength
    FROM cluster_timeline_state
    WHERE cluster_id = ? AND collection_round_id < ?
    ORDER BY collection_round_id DESC
    LIMIT 1
    `,
  );

  const stmtGetPrev = db.prepare(
    `
    SELECT 1
    FROM notification_event_log
    WHERE user_id = ?
      AND event_key = ?
      AND signal_fingerprint = ?
      AND created_at_utc >= datetime(?, '-7 days')
    LIMIT 1
    `,
  );

  const stmtInsert = db.prepare(
    `
    INSERT INTO notification_event_log (user_id, event_key, reminder_level, signal_fingerprint, payload_json, status)
    VALUES (?, ?, ?, ?, ?, 'queued')
    `,
  );

  const highIds: string[] = [];
  const mediumIds: string[] = [];

  const appCfg = loadAppConfig();
  const w = appCfg.reminderWeights;
  const scoreThresholds = {
    highMin: appCfg.reminderHighThreshold,
    mediumMin: appCfg.reminderMediumThreshold,
  };

  for (const { cluster_id } of clusterRows) {
    const dsRow = stmtLoad.get(cluster_id) as { signal_schema_version: string; signals_json: string } | undefined;
    if (!dsRow) continue;
    if (dsRow.signal_schema_version !== SIGNAL_SCHEMA_VERSION) continue;

    const cur = stmtCurrentTimeline.get(roundId, cluster_id) as
      | {
          evidence_ref_ids_json: string | null;
          claim_text_hash: string | null;
          conflict_strength: number | null;
          cluster_kind: string;
        }
      | undefined;
    if (!cur) continue;

    const prev = stmtPrevTimeline.get(cluster_id, roundId) as
      | {
          evidence_ref_ids_json: string | null;
          claim_text_hash: string | null;
          conflict_strength: number | null;
        }
      | undefined;

    const oldRefs = parseRefIdsJson(prev?.evidence_ref_ids_json);
    const newRefs = parseRefIdsJson(cur.evidence_ref_ids_json);
    const evidence_novelty = computeEvidenceNovelty(oldRefs, newRefs);
    const conclusion_delta = computeConclusionDeltaFromClaimHashes(prev?.claim_text_hash ?? null, cur.claim_text_hash ?? '');
    const newStrength = cur.conflict_strength ?? 0;
    const oldStrength = prev?.conflict_strength ?? null;
    const conflict_delta = computeConflictDelta(oldStrength, newStrength);

    const significant_change_score = computeSignificantChangeScore(
      evidence_novelty,
      conclusion_delta,
      conflict_delta,
      w,
    );

    const reminder_level = mapScoreToReminderLevel(significant_change_score, scoreThresholds);

    const cluster_kind = cur.cluster_kind === 'event_update' ? 'event_update' : 'topic_drift';

    if (
      !shouldQueueWebPushNotification({
        cluster_kind,
        reminder_level,
        evidence_novelty,
        conclusion_delta,
        conflict_delta,
        weights: w,
      })
    ) {
      continue;
    }

    if (!reminder_level) continue;

    const signal = JSON.parse(dsRow.signals_json) as { change?: { change_summary?: string } };
    const signal_fingerprint = computeSignalFingerprintFromSignalsJson(dsRow.signals_json);

    const event_key = resolveEvidenceRootClusterId(db, cluster_id);

    const alreadySent = stmtGetPrev.get(USER_ID, event_key, signal_fingerprint, nowUtcIso) ? true : false;
    if (alreadySent) continue;

    const change_summary = String(signal?.change?.change_summary ?? '');
    const title = `Key change (${reminder_level})`;

    const payload = buildPushPayload({
      event_key,
      reminder_level,
      title,
      short_summary_source: change_summary,
    });

    stmtInsert.run(USER_ID, event_key, reminder_level, signal_fingerprint, JSON.stringify(payload));

    if (reminder_level === 'high') highIds.push(cluster_id);
    else mediumIds.push(cluster_id);
  }

  return { high: highIds.length, medium: mediumIds.length };
}
