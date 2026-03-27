import React from 'react';
import type {
  ClusterDetailResponse,
  LevelFilter,
  SearchResult,
  TimelineRoleFilter,
} from '../types/ui';

type SearchText = {
  level: string;
  search: string;
  searching: string;
  placeholder: string;
  hit: string;
  noResult: string;
  inputTip: string;
  detail: string;
  clusterDetail: string;
  close: string;
  loading: string;
  timelineEvidence: string;
  evidenceNone: string;
  copy: string;
  source: string;
  persScore: string;
};

type Props = {
  t: SearchText;
  q: string;
  loading: boolean;
  error: string | null;
  results: SearchResult[];
  searchLevelFilter: LevelFilter;
  selectedClusterId: string | null;
  clusterDetailLoading: boolean;
  clusterDetailError: string | null;
  clusterDetail: ClusterDetailResponse | null;
  timelineRoleFilter: TimelineRoleFilter;
  onSearch: () => void;
  onChangeQuery: (value: string) => void;
  onChangeSearchLevelFilter: (v: LevelFilter) => void;
  onLoadClusterDetail: (clusterId: string) => void;
  onCloseClusterDetail: () => void;
  onChangeTimelineRoleFilter: (v: TimelineRoleFilter) => void;
  formatPublishedAt: (v: string) => string;
  copyText: (v: string) => Promise<void>;
  personalizationReasonsAndFeedbackRow: (
    clusterId: string,
    reasons?: string[],
    marginTop?: number,
  ) => React.ReactNode;
};

export function SearchPage(props: Props) {
  const {
    t,
    q,
    loading,
    error,
    results,
    searchLevelFilter,
    selectedClusterId,
    clusterDetailLoading,
    clusterDetailError,
    clusterDetail,
    timelineRoleFilter,
    onSearch,
    onChangeQuery,
    onChangeSearchLevelFilter,
    onLoadClusterDetail,
    onCloseClusterDetail,
    onChangeTimelineRoleFilter,
    formatPublishedAt,
    copyText,
    personalizationReasonsAndFeedbackRow,
  } = props;

  const visibleCount =
    searchLevelFilter === 'ALL' ? results.length : results.filter((r) => (r.level ?? 'MEDIUM') === searchLevelFilter).length;

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#666' }}>{t.level}:</span>
        {(['ALL', 'HIGH', 'MEDIUM'] as const).map((lv) => (
          <button
            key={lv}
            onClick={() => onChangeSearchLevelFilter(lv)}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid #ddd',
              cursor: 'pointer',
              background: searchLevelFilter === lv ? '#eef6ff' : '#fff',
              fontSize: 12,
            }}
          >
            {lv}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => onChangeQuery(e.target.value)}
          placeholder={t.placeholder}
          style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
        />
        <button onClick={() => void onSearch()} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>
          {loading ? t.searching : t.search}
        </button>
      </div>

      {error ? (
        <div style={{ color: '#b00020', marginBottom: 12 }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div style={{ color: '#666', marginBottom: 10 }}>{visibleCount ? `${t.hit} ${visibleCount}` : q.trim() ? t.noResult : t.inputTip}</div>

      <div>
        {results
          .filter((r) => searchLevelFilter === 'ALL' || (r.level ?? 'MEDIUM') === searchLevelFilter)
          .map((r) => (
            <div key={r.cluster_id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ fontSize: 12, color: '#666' }}>cluster_id: {r.cluster_id}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {typeof r.personalization_score === 'number' && Number.isFinite(r.personalization_score) ? (
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
                      {t.persScore}: {r.personalization_score.toFixed(2)}
                    </span>
                  ) : null}
                  <span
                    style={{
                      fontSize: 11,
                      borderRadius: 999,
                      padding: '2px 8px',
                      border: '1px solid',
                      borderColor: (r.level ?? 'MEDIUM') === 'HIGH' ? '#ff8a65' : '#90a4ae',
                      color: (r.level ?? 'MEDIUM') === 'HIGH' ? '#d84315' : '#455a64',
                      background: (r.level ?? 'MEDIUM') === 'HIGH' ? '#fff3ee' : '#f3f7f9',
                    }}
                  >
                    {r.level ?? 'MEDIUM'}
                  </span>
                </div>
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{r.content_summary}</div>
              <div style={{ color: '#333', marginTop: 6 }}>{r.snippet_text}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>cluster_kind: {r.cluster_kind ?? 'topic_drift'}</div>
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => void onLoadClusterDetail(r.cluster_id)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}
                >
                  {t.detail}
                </button>
              </div>
              {Array.isArray(r.tags) && r.tags.length ? (
                <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>tags: {r.tags.join(', ')}</div>
              ) : null}
              {personalizationReasonsAndFeedbackRow(r.cluster_id, r.personalization_reasons)}
            </div>
          ))}
      </div>

      {selectedClusterId ? (
        <div style={{ marginTop: 14, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#fbfbfb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{t.clusterDetail}</h3>
            <button onClick={onCloseClusterDetail} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>
              {t.close}
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>cluster_id: {selectedClusterId}</div>
          {clusterDetailLoading ? <div style={{ marginTop: 8 }}>{t.loading}</div> : null}
          {clusterDetailError ? <div style={{ marginTop: 8, color: '#b00020' }}>{clusterDetailError}</div> : null}
          {clusterDetail ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600 }}>{clusterDetail.content_summary}</div>
              <div style={{ marginTop: 4 }}>{clusterDetail.snippet_text}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>tags: {(clusterDetail.tags ?? []).join(', ')}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <h4 style={{ margin: 0 }}>{t.timelineEvidence}</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['all', 'supports', 'contradicts', 'context'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => onChangeTimelineRoleFilter(role)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 999,
                        border: '1px solid #d1d5db',
                        cursor: 'pointer',
                        background: timelineRoleFilter === role ? '#eef6ff' : '#fff',
                        fontSize: 12,
                      }}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              {(() => {
                const filtered = (clusterDetail.timeline ?? [])
                  .filter((timelineItem) => timelineRoleFilter === 'all' || timelineItem.role === timelineRoleFilter)
                  .sort((a, b) => {
                    const ta = Date.parse(a.published_at || '');
                    const tb = Date.parse(b.published_at || '');
                    const va = Number.isNaN(ta) ? 0 : ta;
                    const vb = Number.isNaN(tb) ? 0 : tb;
                    return vb - va;
                  });

                if (filtered.length === 0) {
                  return <div style={{ color: '#666', marginTop: 8 }}>{t.evidenceNone}</div>;
                }

                return filtered.map((timelineItem) => (
                  <div key={timelineItem.id} style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      role={timelineItem.role} · confidence={Number(timelineItem.link_confidence).toFixed(2)}
                      {timelineItem.published_at ? ` · published_at=${formatPublishedAt(timelineItem.published_at)}` : ''}
                    </div>
                    <div style={{ marginTop: 4 }}>{timelineItem.snippet_text}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                      <button
                        onClick={() => void copyText(timelineItem.snippet_text)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12 }}
                      >
                        {t.copy}
                      </button>
                      {timelineItem.url ? (
                        <a href={timelineItem.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', fontSize: 12 }}>
                          {t.source}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
