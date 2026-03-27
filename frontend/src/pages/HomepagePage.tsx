import React from 'react';

import type { DemoStatusPanelData } from '../components/DemoStatusPanel';
import { MediumPriorityBanner } from '../components/MediumPriorityBanner';
import type { HomepageResponse, LevelFilter, UiLang } from '../types/ui';

type HomepageText = {
  refreshHomepage: string;
  level: string;
  metricsTitle: string;
  metricsEmpty: string;
  metricsHigh: string;
  metricsMedium: string;
  metricsRssFail: string;
  metricsQueued: string;
  metricsSent: string;
  metricsFailed: string;
  metricsSkipped: string;
  metricsTrendTitle: string;
  metricsTrendRound: string;
  metricsTrendUpdatedAt: string;
  metricsNoiseRatio: string;
  metricsIngestHealth: string;
  metricsAlertHighNoise: string;
  metricsAlertLowIngestHealth: string;
  metricsRecommendationTitle: string;
  metricsRecommendationTune: string;
  metricsRecommendationApply: string;
  policyTuningTitle: string;
  policySnapshotTitle: string;
  policyChangeLogTitle: string;
  policyChangeLogEmpty: string;
  policyReviewWindowTitle: string;
  policyReviewAfter: string;
  policyReviewBefore: string;
  decisionCards: string;
  persScore: string;
  viewSource: string;
  topicBoard: string;
  topicNone: string;
  timeline: string;
};

type Props = {
  lang: UiLang;
  t: HomepageText;
  homepageLoading: boolean;
  homepageError: string | null;
  homepageLevelFilter: LevelFilter;
  homepage: HomepageResponse;
  demoStatus: DemoStatusPanelData | null;
  onRefresh: () => void;
  onChangeLevelFilter: (level: LevelFilter) => void;
  onApplySuggestedHighThreshold: (v: number) => void;
  levelFromClusterKind: (clusterKind?: string) => 'HIGH' | 'MEDIUM';
  personalizationReasonsAndFeedbackRow: (
    clusterId: string,
    reasons?: string[],
    marginTop?: number,
  ) => React.ReactNode;
};

export function HomepagePage({
  lang,
  t,
  homepageLoading,
  homepageError,
  homepageLevelFilter,
  homepage,
  demoStatus,
  onRefresh,
  onChangeLevelFilter,
  onApplySuggestedHighThreshold,
  levelFromClusterKind,
  personalizationReasonsAndFeedbackRow,
}: Props) {
  const filteredDecisionCards = homepage.decision_cards.filter(
    (c) => homepageLevelFilter === 'ALL' || levelFromClusterKind(c.cluster_kind) === homepageLevelFilter,
  );
  const filteredTimeline = homepage.timeline_feed.filter(
    (c) => homepageLevelFilter === 'ALL' || levelFromClusterKind(c.cluster_kind) === homepageLevelFilter,
  );
  const mediumClusterIds = new Set<string>();
  for (const c of filteredDecisionCards) {
    if (levelFromClusterKind(c.cluster_kind) === 'MEDIUM') mediumClusterIds.add(c.cluster_id);
  }
  for (const c of filteredTimeline) {
    if (levelFromClusterKind(c.cluster_kind) === 'MEDIUM') mediumClusterIds.add(c.cluster_id);
  }
  const mediumTotal = mediumClusterIds.size;
  const recent = Array.isArray(demoStatus?.metrics?.recent_rounds) ? demoStatus.metrics.recent_rounds : [];
  const latestNoise = demoStatus?.metrics?.latest_round?.noise_ratio ?? null;
  const latestIngestHealth = demoStatus?.metrics?.latest_round?.ingest_health ?? null;
  const last3Noise = recent.slice(0, 3).map((r) => r.noise_ratio);
  const hasRisingNoise3 =
    last3Noise.length >= 3 && last3Noise[0] > last3Noise[1] && last3Noise[1] > last3Noise[2];

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => void onRefresh()}
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}
        >
          {homepageLoading ? '...' : t.refreshHomepage}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#666' }}>{t.level}:</span>
        {(['ALL', 'HIGH', 'MEDIUM'] as const).map((lv) => (
          <button
            key={lv}
            onClick={() => onChangeLevelFilter(lv)}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid #ddd',
              cursor: 'pointer',
              background: homepageLevelFilter === lv ? '#eef6ff' : '#fff',
              fontSize: 12,
            }}
          >
            {lv}
          </button>
        ))}
      </div>

      {homepageError ? (
        <div style={{ color: '#b00020', marginBottom: 12 }}>
          <b>Error:</b> {homepageError}
        </div>
      ) : null}

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 10,
          marginBottom: 12,
          background: '#fafafa',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t.metricsTitle}</div>
        {demoStatus?.metrics?.latest_round ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 999, padding: '2px 8px' }}>
              {t.metricsHigh}: {demoStatus.metrics.latest_round.notifications_high}
            </span>
            <span style={{ fontSize: 12, border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 999, padding: '2px 8px' }}>
              {t.metricsMedium}: {demoStatus.metrics.latest_round.notifications_medium}
            </span>
            <span style={{ fontSize: 12, border: '1px solid #fecaca', background: '#fff1f2', borderRadius: 999, padding: '2px 8px' }}>
              {t.metricsRssFail}: {demoStatus.metrics.latest_round.rss_feed_failures}
            </span>
            <span style={{ fontSize: 12, border: '1px solid #ddd6fe', background: '#f5f3ff', borderRadius: 999, padding: '2px 8px' }}>
              {t.metricsNoiseRatio}: {(demoStatus.metrics.latest_round.noise_ratio * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: 12, border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 999, padding: '2px 8px' }}>
              {t.metricsIngestHealth}:{' '}
              {demoStatus.metrics.latest_round.ingest_health == null
                ? 'n/a'
                : `${(demoStatus.metrics.latest_round.ingest_health * 100).toFixed(1)}%`}
            </span>
            {demoStatus.notification_counts ? (
              <>
                <span style={{ fontSize: 12, border: '1px solid #e5e7eb', background: '#fff', borderRadius: 999, padding: '2px 8px' }}>
                  {t.metricsQueued}: {demoStatus.notification_counts.queued}
                </span>
                <span style={{ fontSize: 12, border: '1px solid #dcfce7', background: '#f0fdf4', borderRadius: 999, padding: '2px 8px' }}>
                  {t.metricsSent}: {demoStatus.notification_counts.sent}
                </span>
                <span style={{ fontSize: 12, border: '1px solid #fecaca', background: '#fff1f2', borderRadius: 999, padding: '2px 8px' }}>
                  {t.metricsFailed}: {demoStatus.notification_counts.failed}
                </span>
                <span style={{ fontSize: 12, border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: 999, padding: '2px 8px' }}>
                  {t.metricsSkipped}: {demoStatus.notification_counts.skipped}
                </span>
              </>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#666' }}>{t.metricsEmpty}</div>
        )}
        {(hasRisingNoise3 || (latestIngestHealth != null && latestIngestHealth < 0.8)) && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hasRisingNoise3 ? (
              <span style={{ fontSize: 12, color: '#9a3412', background: '#ffedd5', border: '1px solid #fed7aa', borderRadius: 999, padding: '2px 8px' }}>
                {t.metricsAlertHighNoise}
              </span>
            ) : null}
            {latestIngestHealth != null && latestIngestHealth < 0.8 ? (
              <span style={{ fontSize: 12, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 999, padding: '2px 8px' }}>
                {t.metricsAlertLowIngestHealth}
              </span>
            ) : null}
          </div>
        )}
        {Array.isArray(demoStatus?.metrics?.recommendations) && demoStatus.metrics.recommendations.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{t.metricsRecommendationTitle}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {demoStatus.metrics.recommendations.map((r, idx) => (
                <div
                  key={`${r.kind}_${idx}`}
                  style={{
                    fontSize: 12,
                    color: r.severity === 'warn' ? '#9a3412' : '#334155',
                    border: '1px solid #fed7aa',
                    background: '#fff7ed',
                    borderRadius: 8,
                    padding: '6px 8px',
                  }}
                >
                  <div>{r.message}</div>
                  {typeof r.suggested_high_threshold === 'number' ? (
                    <div style={{ marginTop: 4 }}>
                      {t.metricsRecommendationTune}: high_threshold={r.suggested_high_threshold.toFixed(2)}
                      <button
                        type="button"
                        onClick={() => onApplySuggestedHighThreshold(r.suggested_high_threshold as number)}
                        style={{
                          marginLeft: 8,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid #fb923c',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        {t.metricsRecommendationApply}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {Array.isArray(demoStatus?.metrics?.recent_rounds) && demoStatus.metrics.recent_rounds.length > 0 ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{t.metricsTrendTitle}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {demoStatus.metrics.recent_rounds.slice(0, 10).map((r) => (
                <div
                  key={r.round_id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignItems: 'center',
                    padding: '6px 8px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fff',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: '#334155' }}>
                    {t.metricsTrendRound} {r.round_id}
                  </span>
                  <span style={{ color: '#64748b' }}>
                    {t.metricsTrendUpdatedAt} {r.created_at_utc}
                  </span>
                  <span style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 999, padding: '1px 8px' }}>
                    {t.metricsHigh}: {r.notifications_high}
                  </span>
                  <span style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 999, padding: '1px 8px' }}>
                    {t.metricsMedium}: {r.notifications_medium}
                  </span>
                  <span style={{ border: '1px solid #fecaca', background: '#fff1f2', borderRadius: 999, padding: '1px 8px' }}>
                    {t.metricsRssFail}: {r.rss_feed_failures}
                  </span>
                  <span style={{ border: '1px solid #ddd6fe', background: '#f5f3ff', borderRadius: 999, padding: '1px 8px' }}>
                    {t.metricsNoiseRatio}: {(r.noise_ratio * 100).toFixed(1)}%
                  </span>
                  <span style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 999, padding: '1px 8px' }}>
                    {t.metricsIngestHealth}: {r.ingest_health == null ? 'n/a' : `${(r.ingest_health * 100).toFixed(1)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {demoStatus?.policy_tuning ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: 8 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                {t.policyTuningTitle} · {t.policySnapshotTitle}
              </div>
              <div style={{ fontSize: 12, color: '#334155', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 999, padding: '1px 8px' }}>
                  high_threshold={demoStatus.policy_tuning.current.high_threshold.toFixed(2)}
                </span>
                <span style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 999, padding: '1px 8px' }}>
                  medium_threshold={demoStatus.policy_tuning.current.medium_threshold.toFixed(2)}
                </span>
              </div>
            </div>
            <div style={{ flex: '2 1 360px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: 8 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                {t.policyTuningTitle} · {t.policyChangeLogTitle}
              </div>
              {demoStatus.policy_tuning.recent_changes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {demoStatus.policy_tuning.recent_changes.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      style={{ fontSize: 12, color: '#334155', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px' }}
                    >
                      <div style={{ color: '#64748b' }}>{c.changed_at_utc}</div>
                      <div>
                        high {c.high_threshold_before.toFixed(2)} -&gt; {c.high_threshold_after.toFixed(2)} · medium{' '}
                        {c.medium_threshold_before.toFixed(2)} -&gt; {c.medium_threshold_after.toFixed(2)}
                      </div>
                      {(() => {
                        const win = demoStatus.policy_tuning?.review_windows?.find((w) => w.change_id === c.id);
                        if (!win) return null;
                        return (
                          <div style={{ marginTop: 6, borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                            <div style={{ color: '#64748b', marginBottom: 4 }}>{t.policyReviewWindowTitle}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div>
                                <span style={{ color: '#334155' }}>{t.policyReviewAfter}:</span>{' '}
                                {win.rounds_after.length > 0
                                  ? win.rounds_after
                                      .slice(0, 3)
                                      .map(
                                        (r) =>
                                          `#${r.round_id} noise ${(r.noise_ratio * 100).toFixed(1)}% / health ${
                                            r.ingest_health == null ? 'n/a' : `${(r.ingest_health * 100).toFixed(1)}%`
                                          }`,
                                      )
                                      .join(' · ')
                                  : 'n/a'}
                              </div>
                              <div>
                                <span style={{ color: '#334155' }}>{t.policyReviewBefore}:</span>{' '}
                                {win.rounds_before.length > 0
                                  ? win.rounds_before
                                      .slice(0, 2)
                                      .map(
                                        (r) =>
                                          `#${r.round_id} noise ${(r.noise_ratio * 100).toFixed(1)}% / health ${
                                            r.ingest_health == null ? 'n/a' : `${(r.ingest_health * 100).toFixed(1)}%`
                                          }`,
                                      )
                                      .join(' · ')
                                  : 'n/a'}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#666' }}>{t.policyChangeLogEmpty}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <MediumPriorityBanner lang={lang} mediumCount={mediumTotal} />

      <h3 style={{ margin: '8px 0' }} data-testid="decision-cards-heading">
        {t.decisionCards} ({filteredDecisionCards.length})
      </h3>
      {filteredDecisionCards.map((c) => (
        <div
          key={c.id}
          data-testid="decision-card"
          style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 12, color: '#666' }}>
              {c.source_type} / {c.source_id}
              <span style={{ marginLeft: 6, color: '#94a3b8' }}>· {c.cluster_id}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {typeof c.personalization_score === 'number' && Number.isFinite(c.personalization_score) ? (
                <span
                  style={{
                    fontSize: 11,
                    borderRadius: 999,
                    padding: '2px 8px',
                    border: '1px solid #c7d2fe',
                    color: '#3730a3',
                    background: '#eef2ff',
                  }}
                >
                  {t.persScore}: {c.personalization_score.toFixed(2)}
                </span>
              ) : null}
              <span
                style={{
                  fontSize: 11,
                  borderRadius: 999,
                  padding: '2px 8px',
                  border: '1px solid',
                  borderColor: levelFromClusterKind(c.cluster_kind) === 'HIGH' ? '#ff8a65' : '#90a4ae',
                  color: levelFromClusterKind(c.cluster_kind) === 'HIGH' ? '#d84315' : '#455a64',
                  background: levelFromClusterKind(c.cluster_kind) === 'HIGH' ? '#fff3ee' : '#f3f7f9',
                }}
              >
                {levelFromClusterKind(c.cluster_kind)}
              </span>
            </div>
          </div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>{c.title || c.content_summary}</div>
          <div style={{ marginTop: 6 }}>{c.change_summary}</div>
          {c.url ? (
            <a href={c.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8 }}>
              {t.viewSource}
            </a>
          ) : null}
          {personalizationReasonsAndFeedbackRow(c.cluster_id, c.personalization_reasons)}
        </div>
      ))}

      <h3 style={{ margin: '12px 0 8px' }}>
        {t.topicBoard} ({homepage.topic_board.length})
      </h3>
      <div style={{ marginBottom: 12, color: '#333', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {homepage.topic_board.length === 0 ? (
          <span>{t.topicNone}</span>
        ) : (
          homepage.topic_board.map((topicItem) => (
            <span
              key={topicItem.topic}
              style={{ border: '1px solid #e5e7eb', borderRadius: 999, padding: '4px 10px', fontSize: 12, background: '#fafafa' }}
            >
              {topicItem.topic} ({topicItem.count})
            </span>
          ))
        )}
      </div>

      <h3 style={{ margin: '12px 0 8px' }}>
        {t.timeline} ({filteredTimeline.length})
      </h3>
      {filteredTimeline.map((i) => (
        <div key={`tl_${i.id}`} data-testid="timeline-row" style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
            <span style={{ color: '#666', fontSize: 12 }}>{i.source_type}</span>
            {typeof i.personalization_score === 'number' && Number.isFinite(i.personalization_score) ? (
              <span
                style={{
                  fontSize: 11,
                  borderRadius: 999,
                  padding: '2px 8px',
                  border: '1px solid #c7d2fe',
                  color: '#3730a3',
                  background: '#eef2ff',
                }}
              >
                {t.persScore}: {i.personalization_score.toFixed(2)}
              </span>
            ) : null}
            <span style={{ flex: '1 1 160px' }}>{i.content_summary}</span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{i.cluster_id}</div>
          {personalizationReasonsAndFeedbackRow(i.cluster_id, i.personalization_reasons, 6)}
        </div>
      ))}
    </>
  );
}
