import React from 'react';
import type { FeedHealthRow, FeedRow, FeedType } from '../types/ui';

type SourcesText = {
  sourcesTitle: string;
  sourcesHint: string;
  feedUrl: string;
  feedType: string;
  feedNameOpt: string;
  social: string;
  tech: string;
  addFeed: string;
  collectStored: string;
  collectStoredRunning: string;
  refreshFeeds: string;
  bookmarkImportTitle: string;
  bookmarkImportHint: string;
  bookmarkPlaceholder: string;
  bookmarkImport: string;
  bookmarkImporting: string;
  loading: string;
  noFeeds: string;
  removeFeed: string;
  feedHealthTitle: string;
  feedHealthNoData: string;
  mute1d: string;
  mute7d: string;
  mute30d: string;
  unmute: string;
  mutedUntil: string;
};

type Props = {
  t: SourcesText;
  feeds: FeedRow[];
  feedsLoading: boolean;
  feedsError: string | null;
  feedHealth: FeedHealthRow[];
  newFeedUrl: string;
  newFeedType: FeedType;
  newFeedName: string;
  collectLoading: boolean;
  collectError: string | null;
  collectInfo: string | null;
  bookmarkJson: string;
  bookmarkLoading: boolean;
  bookmarkError: string | null;
  bookmarkInfo: string | null;
  onSetNewFeedUrl: (v: string) => void;
  onSetNewFeedType: (v: FeedType) => void;
  onSetNewFeedName: (v: string) => void;
  onAddFeedRow: () => void;
  onCollectFromStoredFeeds: () => void;
  onLoadFeeds: () => void;
  onSetBookmarkJson: (v: string) => void;
  onImportBookmarksFromJson: () => void;
  onDeleteFeedRow: (id: number) => void;
  onPatchFeedMute: (id: number, muteDays: number) => void;
};

export function SourcesPage(props: Props) {
  const {
    t,
    feeds,
    feedsLoading,
    feedsError,
    feedHealth,
    newFeedUrl,
    newFeedType,
    newFeedName,
    collectLoading,
    collectError,
    collectInfo,
    bookmarkJson,
    bookmarkLoading,
    bookmarkError,
    bookmarkInfo,
    onSetNewFeedUrl,
    onSetNewFeedType,
    onSetNewFeedName,
    onAddFeedRow,
    onCollectFromStoredFeeds,
    onLoadFeeds,
    onSetBookmarkJson,
    onImportBookmarksFromJson,
    onDeleteFeedRow,
    onPatchFeedMute,
  } = props;

  return (
    <>
      <div style={{ border: '1px solid #e0e7ff', borderRadius: 10, padding: 12, marginBottom: 12, background: '#fafbff' }}>
        <h3 style={{ margin: '0 0 8px' }}>{t.sourcesTitle}</h3>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{t.sourcesHint}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ fontSize: 11, color: '#666' }}>{t.feedUrl}</div>
            <input
              data-testid="input-feed-url"
              value={newFeedUrl}
              onChange={(e) => onSetNewFeedUrl(e.target.value)}
              placeholder="https://..."
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginTop: 4 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#666' }}>{t.feedType}</div>
            <select
              value={newFeedType}
              onChange={(e) => onSetNewFeedType(e.target.value === 'tech' ? 'tech' : 'social')}
              style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, marginTop: 4 }}
            >
              <option value="social">{t.social}</option>
              <option value="tech">{t.tech}</option>
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <div style={{ fontSize: 11, color: '#666' }}>{t.feedNameOpt}</div>
            <input
              value={newFeedName}
              onChange={(e) => onSetNewFeedName(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginTop: 4 }}
            />
          </div>
          <button
            type="button"
            data-testid="btn-add-feed"
            disabled={feedsLoading}
            onClick={() => void onAddFeedRow()}
            style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}
          >
            {t.addFeed}
          </button>
        </div>
        {feedsError ? <div style={{ color: '#b00020', marginBottom: 8 }}>{feedsError}</div> : null}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="btn-collect-stored"
            disabled={collectLoading || feedsLoading}
            onClick={() => void onCollectFromStoredFeeds()}
            style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #1d4ed8', background: '#eff6ff', cursor: 'pointer' }}
          >
            {collectLoading ? t.collectStoredRunning : t.collectStored}
          </button>
          <button
            type="button"
            onClick={() => void onLoadFeeds()}
            style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}
          >
            {t.refreshFeeds}
          </button>
        </div>
        {collectError ? <div style={{ color: '#b00020', marginBottom: 8 }}>{collectError}</div> : null}
        {collectInfo ? <div style={{ color: '#166534', marginBottom: 8 }}>{collectInfo}</div> : null}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
          <h4 style={{ margin: '0 0 6px' }}>{t.bookmarkImportTitle}</h4>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{t.bookmarkImportHint}</div>
          <textarea
            data-testid="textarea-bookmark-json"
            value={bookmarkJson}
            onChange={(e) => onSetBookmarkJson(e.target.value)}
            placeholder={t.bookmarkPlaceholder}
            rows={6}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 10,
              border: '1px solid #ddd',
              borderRadius: 6,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              marginBottom: 8,
            }}
          />
          <button
            type="button"
            data-testid="btn-import-bookmarks"
            disabled={bookmarkLoading}
            onClick={() => void onImportBookmarksFromJson()}
            style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #6366f1', background: '#eef2ff', cursor: 'pointer' }}
          >
            {bookmarkLoading ? t.bookmarkImporting : t.bookmarkImport}
          </button>
          {bookmarkError ? <div style={{ color: '#b00020', marginTop: 8 }}>{bookmarkError}</div> : null}
          {bookmarkInfo ? <div style={{ color: '#166534', marginTop: 8 }}>{bookmarkInfo}</div> : null}
        </div>

        {feedsLoading ? <div style={{ color: '#666' }}>{t.loading}</div> : null}
        {!feeds.length && !feedsLoading ? <div style={{ color: '#666' }}>{t.noFeeds}</div> : null}
        {feeds.map((f) => {
          const mutedUntil = f.muted_until_utc;
          const isMuted = Boolean(mutedUntil && new Date(mutedUntil).getTime() > Date.now());
          return (
            <div
              key={f.id}
              style={{
                border: '1px solid #eee',
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {f.source_type} · id={f.id}
                  {isMuted ? (
                    <span style={{ marginLeft: 8, color: '#c2410c', fontWeight: 600 }}>· muted</span>
                  ) : null}
                </div>
                <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>{f.feed_url}</div>
                {f.source_name ? <div style={{ fontSize: 12, color: '#64748b' }}>{f.source_name}</div> : null}
                {isMuted && mutedUntil ? (
                  <div style={{ fontSize: 11, color: '#9a3412', marginTop: 4 }}>
                    {t.mutedUntil}: {mutedUntil}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={feedsLoading}
                    onClick={() => void onPatchFeedMute(f.id, 1)}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fed7aa', cursor: 'pointer', fontSize: 11 }}
                  >
                    {t.mute1d}
                  </button>
                  <button
                    type="button"
                    disabled={feedsLoading}
                    onClick={() => void onPatchFeedMute(f.id, 7)}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fed7aa', cursor: 'pointer', fontSize: 11 }}
                  >
                    {t.mute7d}
                  </button>
                  <button
                    type="button"
                    disabled={feedsLoading}
                    onClick={() => void onPatchFeedMute(f.id, 30)}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fed7aa', cursor: 'pointer', fontSize: 11 }}
                  >
                    {t.mute30d}
                  </button>
                  <button
                    type="button"
                    disabled={feedsLoading}
                    onClick={() => void onPatchFeedMute(f.id, 0)}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: 11 }}
                  >
                    {t.unmute}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void onDeleteFeedRow(f.id)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}
                >
                  {t.removeFeed}
                </button>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
          <h4 style={{ margin: '0 0 8px' }}>{t.feedHealthTitle}</h4>
          {feedHealth.length === 0 ? (
            <div style={{ fontSize: 12, color: '#666' }}>{t.feedHealthNoData}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {feedHealth.map((h) => (
                <div key={h.feed_url} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                  <div style={{ color: '#64748b' }}>
                    {h.source_type} · {h.source_name || h.feed_url}
                  </div>
                  <div style={{ marginTop: 4, wordBreak: 'break-all' }}>{h.feed_url}</div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>muted={String(h.is_muted)}</span>
                    <span>status={h.last_status}</span>
                    <span>ok={h.total_successes}</span>
                    <span>fail={h.total_failures}</span>
                    <span>consecutive_fail={h.consecutive_failures}</span>
                    <span>success_rate={h.success_rate == null ? 'n/a' : `${(h.success_rate * 100).toFixed(1)}%`}</span>
                    <span>suggest={h.recommendation}</span>
                  </div>
                  {h.recommendation_message ? (
                    <div style={{ marginTop: 4, color: '#475569' }}>{h.recommendation_message}</div>
                  ) : null}
                  {h.last_error ? <div style={{ marginTop: 4, color: '#9a3412' }}>last_error: {h.last_error}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
