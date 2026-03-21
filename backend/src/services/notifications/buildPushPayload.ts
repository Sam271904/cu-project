import crypto from 'node:crypto';

export function truncateWithEllipsis(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  if (maxChars <= 3) return input.slice(0, maxChars);
  return input.slice(0, maxChars - 3) + '...';
}

export type ReminderLevel = 'high' | 'medium';

export function buildPushPayload(opts: {
  event_key: string;
  reminder_level: ReminderLevel;
  title: string;
  short_summary_source: string;
}): { event_key: string; reminder_level: ReminderLevel; title: string; short_summary: string } {
  const short_summary = truncateWithEllipsis(String(opts.short_summary_source ?? ''), 120);

  // Strict keyset (spec requirement)
  return {
    event_key: opts.event_key,
    reminder_level: opts.reminder_level,
    title: opts.title,
    short_summary,
  };
}

export function signalFingerprintFromSignalsJson(signals_json: string, signal_schema_version: string): string {
  // Deterministic fingerprint; in v1 this replaces the full evidence_ref_ids derivation
  // (until we fully materialize evidence_ref_ids in extraction).
  const input = `${signal_schema_version}|${signals_json}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

