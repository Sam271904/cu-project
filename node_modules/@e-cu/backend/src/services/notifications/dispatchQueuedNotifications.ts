import type Database from 'better-sqlite3';
import webPush from 'web-push';

export type PushDispatchMode = 'simulate' | 'real';

type StrictPushPayload = {
  event_key: string;
  reminder_level: 'high' | 'medium';
  title: string;
  short_summary: string;
};

function isStrictPushPayload(x: any): x is StrictPushPayload {
  if (!x || typeof x !== 'object') return false;
  const keys = Object.keys(x).sort();
  const expected = ['event_key', 'reminder_level', 'short_summary', 'title'].sort();
  if (keys.join('|') !== expected.join('|')) return false;
  if (typeof x.event_key !== 'string') return false;
  if (x.reminder_level !== 'high' && x.reminder_level !== 'medium') return false;
  if (typeof x.title !== 'string') return false;
  if (typeof x.short_summary !== 'string') return false;
  return true;
}

export async function dispatchQueuedNotifications(
  db: Database.Database,
  opts: {
    userId: string;
    mode: PushDispatchMode;
    limit: number;
    nowUtcIso: string;
  },
): Promise<{
  success: boolean;
  mode: PushDispatchMode;
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  results: Array<{ id: number; event_key: string; action: string }>;
}> {
  if (opts.mode === 'real') {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return {
        success: false,
        mode: opts.mode,
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        results: [
          {
            id: -1,
            event_key: '',
            action: 'missing_vapid_env',
          },
        ],
      };
    }

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }

  const subscriptionRows = db
    .prepare(
      `
      SELECT endpoint, subscription_json
      FROM notification_subscriptions
      WHERE endpoint IS NOT NULL
      `,
    )
    .all() as Array<{ endpoint: string; subscription_json: string }>;
  const hasAnySubscription = subscriptionRows.length > 0;

  const selectQueued = db.prepare(
    `
    SELECT
      id,
      event_key,
      payload_json,
      status
    FROM notification_event_log
    WHERE user_id = ? AND status = 'queued'
    ORDER BY id ASC
    LIMIT ?
    `,
  );

  const queued = selectQueued.all(opts.userId, opts.limit) as Array<{
    id: number;
    event_key: string;
    payload_json: string;
    status: string;
  }>;

  const updateStatus = db.prepare(
    `UPDATE notification_event_log SET status = ? WHERE id = ? AND status = 'queued'`,
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const results: Array<{ id: number; event_key: string; action: string }> = [];

  for (const ev of queued) {
    let parsed: any = null;
    try {
      parsed = JSON.parse(ev.payload_json);
    } catch {
      parsed = null;
    }

    if (!isStrictPushPayload(parsed)) {
      updateStatus.run('failed_bad_payload', ev.id);
      failed++;
      results.push({ id: ev.id, event_key: ev.event_key, action: 'failed_bad_payload' });
      continue;
    }

    if (!hasAnySubscription) {
      updateStatus.run('skipped_no_subscription', ev.id);
      skipped++;
      results.push({ id: ev.id, event_key: ev.event_key, action: 'skipped_no_subscription' });
      continue;
    }

    if (opts.mode === 'simulate') {
      // simulate mode: do not actually call external push services.
      updateStatus.run('sent', ev.id);
      sent++;
      results.push({ id: ev.id, event_key: ev.event_key, action: 'simulated_sent' });
      continue;
    }

    // real mode: send to all subscriptions; mark sent if any endpoint succeeds.
    let anySuccess = false;
    let allFailed = true;

    for (const subRow of subscriptionRows) {
      let sub: any = null;
      try {
        sub = JSON.parse(subRow.subscription_json);
      } catch {
        sub = null;
      }
      if (!sub) continue;

      const payloadToSend = JSON.stringify(parsed);

      try {
        await webPush.sendNotification(sub, payloadToSend);
        anySuccess = true;
        allFailed = false;
      } catch {
        // Try other endpoints; failure of one endpoint doesn't block others.
        allFailed = allFailed && true;
      }
    }

    if (anySuccess) {
      updateStatus.run('sent', ev.id);
      sent++;
      results.push({ id: ev.id, event_key: ev.event_key, action: 'sent' });
    } else if (allFailed) {
      updateStatus.run('failed_push', ev.id);
      failed++;
      results.push({ id: ev.id, event_key: ev.event_key, action: 'failed_push' });
    } else {
      // Defensive fallback; shouldn't happen.
      updateStatus.run('failed_push', ev.id);
      failed++;
      results.push({ id: ev.id, event_key: ev.event_key, action: 'failed_push_unknown' });
    }
  }

  return {
    success: true,
    mode: opts.mode,
    processed: queued.length,
    sent,
    skipped,
    failed,
    results,
  };
}

