import type Database from 'better-sqlite3';

import { loadAppConfig, type AppConfig } from '../../config';
import type { ReminderWeights } from './reminderScoring';

export type RuntimeNotificationPolicy = {
  weights: ReminderWeights;
  high_threshold: number;
  medium_threshold: number;
  claim_embedding_enabled: boolean;
  embedding_model: string;
};

export type NotificationPolicyChangeLog = {
  id: number;
  changed_at_utc: string;
  high_threshold_before: number;
  high_threshold_after: number;
  medium_threshold_before: number;
  medium_threshold_after: number;
  change_source: string;
};

type ThresholdOverrides = {
  high_threshold?: number;
  medium_threshold?: number;
};

function parseOptionalThreshold(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0 || n >= 1) return undefined;
  return n;
}

function readThresholdOverrides(db: Database.Database): ThresholdOverrides {
  const rows = db
    .prepare(
      `
      SELECT setting_key, setting_value
      FROM app_runtime_settings
      WHERE setting_key IN ('notification.high_threshold', 'notification.medium_threshold')
      `,
    )
    .all() as Array<{ setting_key: string; setting_value: string }>;
  const out: ThresholdOverrides = {};
  for (const row of rows) {
    if (row.setting_key === 'notification.high_threshold') {
      out.high_threshold = parseOptionalThreshold(row.setting_value);
    } else if (row.setting_key === 'notification.medium_threshold') {
      out.medium_threshold = parseOptionalThreshold(row.setting_value);
    }
  }
  return out;
}

function mergeThresholds(base: AppConfig, overrides: ThresholdOverrides): { high_threshold: number; medium_threshold: number } {
  const high_threshold = overrides.high_threshold ?? base.reminderHighThreshold;
  const medium_threshold = overrides.medium_threshold ?? base.reminderMediumThreshold;
  if (medium_threshold >= high_threshold) {
    return {
      high_threshold: base.reminderHighThreshold,
      medium_threshold: base.reminderMediumThreshold,
    };
  }
  return { high_threshold, medium_threshold };
}

export function loadRuntimeNotificationPolicy(db: Database.Database): RuntimeNotificationPolicy {
  const appCfg = loadAppConfig();
  const thresholds = mergeThresholds(appCfg, readThresholdOverrides(db));
  return {
    weights: appCfg.reminderWeights,
    high_threshold: thresholds.high_threshold,
    medium_threshold: thresholds.medium_threshold,
    claim_embedding_enabled: appCfg.claimEmbeddingEnabled && Boolean(appCfg.llmApiKey),
    embedding_model: appCfg.embeddingModel,
  };
}

export function saveRuntimeNotificationPolicy(
  db: Database.Database,
  patch: { high_threshold?: number; medium_threshold?: number },
): RuntimeNotificationPolicy {
  const base = loadRuntimeNotificationPolicy(db);
  const candidate = {
    high_threshold: parseOptionalThreshold(patch.high_threshold) ?? base.high_threshold,
    medium_threshold: parseOptionalThreshold(patch.medium_threshold) ?? base.medium_threshold,
  };
  if (candidate.medium_threshold >= candidate.high_threshold) {
    throw new Error('invalid_threshold_pair');
  }
  const upsert = db.prepare(
    `
    INSERT INTO app_runtime_settings (setting_key, setting_value)
    VALUES (?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
    `,
  );
  upsert.run('notification.high_threshold', String(candidate.high_threshold));
  upsert.run('notification.medium_threshold', String(candidate.medium_threshold));
  const changed =
    candidate.high_threshold !== base.high_threshold || candidate.medium_threshold !== base.medium_threshold;
  if (changed) {
    db.prepare(
      `
      INSERT INTO notification_policy_change_log
        (high_threshold_before, high_threshold_after, medium_threshold_before, medium_threshold_after, change_source)
      VALUES (?, ?, ?, ?, 'api')
      `,
    ).run(base.high_threshold, candidate.high_threshold, base.medium_threshold, candidate.medium_threshold);
  }
  return {
    ...base,
    high_threshold: candidate.high_threshold,
    medium_threshold: candidate.medium_threshold,
  };
}

export function loadNotificationPolicyChangeLogs(
  db: Database.Database,
  limit = 10,
): NotificationPolicyChangeLog[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
  return db
    .prepare(
      `
      SELECT id, changed_at_utc, high_threshold_before, high_threshold_after,
             medium_threshold_before, medium_threshold_after, change_source
      FROM notification_policy_change_log
      ORDER BY id DESC
      LIMIT ?
      `,
    )
    .all(safeLimit) as NotificationPolicyChangeLog[];
}
