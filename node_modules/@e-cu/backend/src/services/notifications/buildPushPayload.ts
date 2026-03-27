import { computeSignalFingerprintFromSignalsJson } from './decisionSignalsFingerprint';
import type { ReminderLevel } from './reminderScoring';

export type { ReminderLevel } from './reminderScoring';

export function truncateWithEllipsis(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  if (maxChars <= 3) return input.slice(0, maxChars);
  return input.slice(0, maxChars - 3) + '...';
}

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

/** @deprecated second arg ignored; use computeSignalFingerprintFromSignalsJson from decisionSignalsFingerprint */
export function signalFingerprintFromSignalsJson(signals_json: string, _signal_schema_version: string): string {
  return computeSignalFingerprintFromSignalsJson(signals_json);
}
