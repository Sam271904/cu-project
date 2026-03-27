import React from 'react';
import type { PushConsentPayload, PushStatusPayload, UiLang } from '../types/ui';

type PushText = {
  pushTitle: string;
  pushHint: string;
  pushTokenLabel: string;
  pushTokenPlaceholder: string;
  pushRefresh: string;
  pushSubscribe: string;
  pushUnsubscribe: string;
  pushPermBrowser: string;
  pushPermServer: string;
  pushHasSub: string;
  pushSubCount: string;
  pushVapidOk: string;
  pushVapidNo: string;
  loading: string;
};

type Props = {
  lang: UiLang;
  t: PushText;
  pushApiToken: string;
  pushInfoLoading: boolean;
  pushActionLoading: boolean;
  pushError: string | null;
  pushInfo: string | null;
  browserNotifPermission: string;
  pushConsent: PushConsentPayload | null;
  pushStatus: PushStatusPayload | null;
  onSetPushApiToken: (v: string) => void;
  onLoadPushInfo: () => void;
  onSubscribeToPush: () => void;
  onUnsubscribeFromPush: () => void;
};

export function PushPage(props: Props) {
  const {
    lang,
    t,
    pushApiToken,
    pushInfoLoading,
    pushActionLoading,
    pushError,
    pushInfo,
    browserNotifPermission,
    pushConsent,
    pushStatus,
    onSetPushApiToken,
    onLoadPushInfo,
    onSubscribeToPush,
    onUnsubscribeFromPush,
  } = props;

  return (
    <div
      style={{
        border: '1px solid #dbeafe',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        background: '#f8fafc',
      }}
      data-testid="panel-push"
    >
      <h3 style={{ margin: '0 0 8px' }}>{t.pushTitle}</h3>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{t.pushHint}</div>

      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155' }}>{t.pushTokenLabel}</label>
      <input
        data-testid="input-push-token"
        type="password"
        autoComplete="off"
        value={pushApiToken}
        onChange={(e) => onSetPushApiToken(e.target.value)}
        placeholder={t.pushTokenPlaceholder}
        style={{
          width: '100%',
          maxWidth: 480,
          boxSizing: 'border-box',
          marginTop: 6,
          marginBottom: 12,
          padding: 8,
          border: '1px solid #ddd',
          borderRadius: 6,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
        }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          type="button"
          data-testid="btn-push-refresh"
          disabled={pushInfoLoading || pushActionLoading}
          onClick={() => void onLoadPushInfo()}
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid #ddd',
            cursor: pushInfoLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {pushInfoLoading ? '...' : t.pushRefresh}
        </button>
        <button
          type="button"
          data-testid="btn-push-subscribe"
          disabled={pushActionLoading || pushInfoLoading}
          onClick={() => void onSubscribeToPush()}
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid #2563eb',
            background: '#eff6ff',
            cursor: pushActionLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {pushActionLoading ? t.loading : t.pushSubscribe}
        </button>
        <button
          type="button"
          data-testid="btn-push-unsubscribe"
          disabled={pushActionLoading || pushInfoLoading}
          onClick={() => void onUnsubscribeFromPush()}
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            cursor: pushActionLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {pushActionLoading ? t.loading : t.pushUnsubscribe}
        </button>
      </div>

      {pushError ? (
        <div style={{ color: '#b00020', marginBottom: 8 }} data-testid="push-error">
          {pushError}
        </div>
      ) : null}
      {pushInfo ? (
        <div style={{ color: '#166534', marginBottom: 8 }} data-testid="push-info">
          {pushInfo}
        </div>
      ) : null}

      <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>
        <b>{t.pushPermBrowser}:</b> {browserNotifPermission}
      </div>
      {pushConsent ? (
        <div style={{ fontSize: 12, color: '#334155', marginBottom: 4 }}>
          <b>{t.pushPermServer}:</b> {pushConsent.push_permission_status}
          {pushConsent.consent_timestamp ? ` · ${pushConsent.consent_timestamp}` : ''}
        </div>
      ) : null}
      {pushConsent ? (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
          {t.pushHasSub}: {pushConsent.has_subscription ? (lang === 'zh' ? '是' : 'yes') : lang === 'zh' ? '否' : 'no'}
          {pushConsent.last_subscription_at_utc ? ` · ${pushConsent.last_subscription_at_utc}` : ''}
        </div>
      ) : null}
      {pushStatus ? (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          {t.pushSubCount}: {pushStatus.subscription_count} · {pushStatus.vapid_configured ? t.pushVapidOk : t.pushVapidNo}
        </div>
      ) : null}
    </div>
  );
}
