import type Database from 'better-sqlite3';

export type NotificationPipelineResult = { high: number; medium: number } | { disabled: true };

/**
 * Lightweight per-round metrics for observability (design: Metrics placeholder).
 */
export function persistPipelineRoundMetrics(
  db: Database.Database,
  roundId: number,
  opts: { rssFeedFailures: number; notifications: NotificationPipelineResult },
): void {
  const n = opts.notifications;
  const high = 'high' in n ? n.high : 0;
  const medium = 'high' in n ? n.medium : 0;
  db.prepare(
    `
    INSERT INTO pipeline_round_metrics (round_id, notifications_high, notifications_medium, rss_feed_failures)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(round_id) DO UPDATE SET
      notifications_high = excluded.notifications_high,
      notifications_medium = excluded.notifications_medium,
      rss_feed_failures = excluded.rss_feed_failures
    `,
  ).run(roundId, high, medium, opts.rssFeedFailures);
}
