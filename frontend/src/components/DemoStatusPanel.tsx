import React from 'react';

export type DemoStatusPanelData = {
  success: boolean;
  latest_round_id: number | null;
  normalized_items: number;
  clusters: number;
  decision_signals: number;
  knowledge_entries: number;
  cluster_kind_summary: Record<string, number>;
  notification_policy?: {
    weights: { w1: number; w2: number; w3: number };
    high_threshold: number;
    medium_threshold: number;
    claim_embedding_enabled?: boolean;
    embedding_model?: string;
  };
  signal_extractor?: string;
  push_pipeline_enabled?: boolean;
  rss_fetch?: {
    max_attempts: number;
    backoff_base_ms: number;
    backoff_max_ms: number;
    rate_limit_per_minute: number;
  };
  llm_configured?: boolean;
  notification_counts?: {
    queued: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  metrics?: {
    latest_round: {
      round_id: number;
      notifications_high: number;
      notifications_medium: number;
      rss_feed_failures: number;
      noise_ratio: number;
      ingest_health: number | null;
      active_feeds: number;
    } | null;
    recent_rounds?: Array<{
      round_id: number;
      created_at_utc: string;
      notifications_high: number;
      notifications_medium: number;
      rss_feed_failures: number;
      noise_ratio: number;
      ingest_health: number | null;
      active_feeds: number;
    }>;
    recommendations?: Array<{
      kind: string;
      severity: string;
      message: string;
      suggested_high_threshold?: number;
    }>;
  };
  policy_tuning?: {
    current: {
      high_threshold: number;
      medium_threshold: number;
    };
    recent_changes: Array<{
      id: number;
      changed_at_utc: string;
      high_threshold_before: number;
      high_threshold_after: number;
      medium_threshold_before: number;
      medium_threshold_after: number;
      change_source: string;
    }>;
    review_windows?: Array<{
      change_id: number;
      changed_at_utc: string;
      high_threshold_after: number;
      medium_threshold_after: number;
      rounds_after: Array<{
        round_id: number;
        created_at_utc: string;
        notifications_high: number;
        notifications_medium: number;
        rss_feed_failures: number;
        noise_ratio: number;
        ingest_health: number | null;
        active_feeds: number;
      }>;
      rounds_before: Array<{
        round_id: number;
        created_at_utc: string;
        notifications_high: number;
        notifications_medium: number;
        rss_feed_failures: number;
        noise_ratio: number;
        ingest_health: number | null;
        active_feeds: number;
      }>;
    }>;
  };
  privacy_checks?: {
    pass: boolean;
    details: {
      has_forbidden_knowledge_columns: boolean;
      has_forbidden_json_keys: boolean;
      max_signal_snippet_length: number;
      max_knowledge_snippet_length: number;
    };
  };
};

type T = {
  demoStatus: string;
  refreshStatus: string;
  noStatus: string;
  privacyPass: string;
  privacyFail: string;
};

type Props = {
  lang: 'zh' | 'en';
  t: T;
  demoStatus: DemoStatusPanelData | null;
  demoStatusLoading: boolean;
  demoStatusError: string | null;
  onRefresh: () => void;
};

export function DemoStatusPanel({ lang, t, demoStatus, demoStatusLoading, demoStatusError, onRefresh }: Props) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, marginBottom: 12, background: '#fafafa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b>{t.demoStatus}</b>
        <button
          type="button"
          onClick={() => void onRefresh()}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12 }}
        >
          {demoStatusLoading ? '...' : t.refreshStatus}
        </button>
      </div>
      {demoStatusError ? <div style={{ marginTop: 6, color: '#b00020' }}>{demoStatusError}</div> : null}
      {demoStatus ? (
        <div style={{ marginTop: 6, fontSize: 12, color: '#333' }}>
          round={String(demoStatus.latest_round_id)} · normalized={demoStatus.normalized_items} · clusters={demoStatus.clusters} ·
          signals={demoStatus.decision_signals} · knowledge={demoStatus.knowledge_entries} · kinds=
          {JSON.stringify(demoStatus.cluster_kind_summary)}
          {' · '}
          privacy=
          {demoStatus.privacy_checks?.pass ? t.privacyPass : t.privacyFail}
          {demoStatus.privacy_checks?.details
            ? `(${`signal_snippet_max=${demoStatus.privacy_checks.details.max_signal_snippet_length}, knowledge_snippet_max=${demoStatus.privacy_checks.details.max_knowledge_snippet_length}`})`
            : ''}
          {demoStatus.notification_policy ? (
            <>
              {' · '}
              reminder w1/w2/w3=
              {demoStatus.notification_policy.weights.w1.toFixed(2)}/
              {demoStatus.notification_policy.weights.w2.toFixed(2)}/
              {demoStatus.notification_policy.weights.w3.toFixed(2)} · high≥
              {demoStatus.notification_policy.high_threshold} · med≥
              {demoStatus.notification_policy.medium_threshold}
              {typeof demoStatus.notification_policy.claim_embedding_enabled === 'boolean' ? (
                <>
                  {' · '}
                  embedding=
                  {demoStatus.notification_policy.claim_embedding_enabled
                    ? lang === 'zh'
                      ? '开'
                      : 'on'
                    : lang === 'zh'
                      ? '关'
                      : 'off'}
                  {demoStatus.notification_policy.embedding_model ? ` (${demoStatus.notification_policy.embedding_model})` : ''}
                </>
              ) : null}
            </>
          ) : null}
          {demoStatus.signal_extractor ? (
            <>
              {' · '}
              extractor={demoStatus.signal_extractor}
            </>
          ) : null}
          {typeof demoStatus.push_pipeline_enabled === 'boolean' ? (
            <>
              {' · '}
              push=
              {demoStatus.push_pipeline_enabled ? (lang === 'zh' ? '开' : 'on') : lang === 'zh' ? '关' : 'off'}
            </>
          ) : null}
          {demoStatus.rss_fetch ? (
            <>
              {' · '}
              rss_retry≤{demoStatus.rss_fetch.max_attempts} · rss_rpm={demoStatus.rss_fetch.rate_limit_per_minute}
            </>
          ) : null}
          {demoStatus.metrics?.latest_round ? (
            <>
              {' · '}
              m_high={demoStatus.metrics.latest_round.notifications_high} · m_med=
              {demoStatus.metrics.latest_round.notifications_medium} · rss_fail=
              {demoStatus.metrics.latest_round.rss_feed_failures}
            </>
          ) : (
            <>
              {' · '}
              metrics_round=n/a
            </>
          )}
          {typeof demoStatus.llm_configured === 'boolean' ? (
            <>
              {' · '}
              llm={demoStatus.llm_configured ? (lang === 'zh' ? '已配置' : 'set') : lang === 'zh' ? '未配置' : 'unset'}
            </>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>{t.noStatus}</div>
      )}
    </div>
  );
}
