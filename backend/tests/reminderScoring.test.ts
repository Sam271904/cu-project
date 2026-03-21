import { describe, expect, it } from 'vitest';
import {
  computeConflictDelta,
  computeConflictStrengthFromDisagreement,
  computeConclusionDeltaFromClaimHashes,
  computeEvidenceNovelty,
  computeSignificantChangeScore,
  mapScoreToReminderLevel,
  shouldQueueWebPushNotification,
  topicDriftConflictDominates,
} from '../src/services/notifications/reminderScoring';

describe('reminderScoring (Task 8.2)', () => {
  it('computeEvidenceNovelty: disjoint sets => 1', () => {
    expect(computeEvidenceNovelty(['a'], ['b'])).toBe(1);
  });

  it('computeEvidenceNovelty: identical sets => 0', () => {
    expect(computeEvidenceNovelty(['a|v', 'b|v'], ['b|v', 'a|v'])).toBe(0);
  });

  it('computeConclusionDeltaFromClaimHashes', () => {
    expect(computeConclusionDeltaFromClaimHashes(null, 'x')).toBe(1);
    expect(computeConclusionDeltaFromClaimHashes('a', 'a')).toBe(0);
    expect(computeConclusionDeltaFromClaimHashes('a', 'b')).toBe(1);
  });

  it('computeConflictStrengthFromDisagreement', () => {
    const s = computeConflictStrengthFromDisagreement({
      evidence_links: [
        { role: 'contradicts', link_confidence: 0.6 },
        { role: 'supports', link_confidence: 0.4 },
      ],
    });
    expect(s).toBeCloseTo(0.6 / 1.0, 5);
  });

  it('computeConflictDelta clamps', () => {
    expect(computeConflictDelta(0.2, 0.5)).toBeCloseTo(0.3, 5);
    expect(computeConflictDelta(null, 0.8)).toBeCloseTo(0.8, 5);
  });

  it('mapScoreToReminderLevel boundaries', () => {
    expect(mapScoreToReminderLevel(0.8)).toBe('high');
    expect(mapScoreToReminderLevel(0.799)).toBe('medium');
    expect(mapScoreToReminderLevel(0.5)).toBe('medium');
    expect(mapScoreToReminderLevel(0.499)).toBe(null);
  });

  it('mapScoreToReminderLevel respects custom thresholds', () => {
    const t = { highMin: 0.7, mediumMin: 0.35 };
    expect(mapScoreToReminderLevel(0.7, t)).toBe('high');
    expect(mapScoreToReminderLevel(0.69, t)).toBe('medium');
    expect(mapScoreToReminderLevel(0.34, t)).toBe(null);
  });

  it('topicDriftConflictDominates', () => {
    const w = { w1: 0.4, w2: 0.4, w3: 0.2 };
    expect(topicDriftConflictDominates(0.1, 0.1, 1, w)).toBe(true);
    expect(topicDriftConflictDominates(1, 1, 0.1, w)).toBe(false);
  });

  it('shouldQueueWebPushNotification: event_update allows medium', () => {
    expect(
      shouldQueueWebPushNotification({
        cluster_kind: 'event_update',
        reminder_level: 'medium',
        evidence_novelty: 1,
        conclusion_delta: 1,
        conflict_delta: 0,
      }),
    ).toBe(true);
  });

  it('shouldQueueWebPushNotification: topic_drift needs high + dominance', () => {
    expect(
      shouldQueueWebPushNotification({
        cluster_kind: 'topic_drift',
        reminder_level: 'medium',
        evidence_novelty: 1,
        conclusion_delta: 1,
        conflict_delta: 1,
      }),
    ).toBe(false);
    expect(
      shouldQueueWebPushNotification({
        cluster_kind: 'topic_drift',
        reminder_level: 'high',
        evidence_novelty: 0.1,
        conclusion_delta: 0.1,
        conflict_delta: 1,
      }),
    ).toBe(true);
  });

  it('computeSignificantChangeScore default weights', () => {
    const s = computeSignificantChangeScore(1, 1, 0.5);
    expect(s).toBeCloseTo(0.4 + 0.4 + 0.1, 5);
  });
});
