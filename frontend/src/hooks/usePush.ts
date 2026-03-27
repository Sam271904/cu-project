import React from 'react';

import type { PushConsentPayload, PushStatusPayload, UiLang } from '../types/ui';
import { loadStoredPushApiToken } from '../utils/localState';
import { getCached, invalidateCache } from '../utils/requestCache';

type UsePushMessages = {
  pushNotSupported: string;
  pushDisabled503: string;
  pushUnauthorized: string;
  pushVapidMissing: string;
  pushOkSubscribed: string;
  pushOkUnsubscribed: string;
};

type UsePushDeps = {
  lang: UiLang;
  msg: UsePushMessages;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePush(deps: UsePushDeps) {
  const PUSH_CONSENT_CACHE_KEY = 'api:/push/consent';
  const PUSH_STATUS_CACHE_KEY = 'api:/push/status';
  const PUSH_TTL_MS = 8_000;

  const { lang, msg } = deps;
  const [pushApiToken, setPushApiToken] = React.useState(() => loadStoredPushApiToken());
  const [pushInfoLoading, setPushInfoLoading] = React.useState(false);
  const [pushActionLoading, setPushActionLoading] = React.useState(false);
  const [pushError, setPushError] = React.useState<string | null>(null);
  const [pushInfo, setPushInfo] = React.useState<string | null>(null);
  const [pushConsent, setPushConsent] = React.useState<PushConsentPayload | null>(null);
  const [pushStatus, setPushStatus] = React.useState<PushStatusPayload | null>(null);
  const [browserNotifPermission, setBrowserNotifPermission] = React.useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );

  function pushAuthHeaders(): Record<string, string> {
    const token = pushApiToken.trim();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  const loadPushInfo = React.useCallback(async (force = false) => {
    setPushInfoLoading(true);
    setPushError(null);
    setPushInfo(null);
    if (typeof Notification !== 'undefined') {
      setBrowserNotifPermission(Notification.permission);
    }
    try {
      const [cJson, sJson] = await Promise.all([
        getCached<{ success?: boolean; error?: string } & Partial<PushConsentPayload>>(
          PUSH_CONSENT_CACHE_KEY,
          PUSH_TTL_MS,
          async () => {
            const cRes = await fetch('/api/push/consent');
            const cJson = (await cRes.json()) as { success?: boolean; error?: string } & Partial<PushConsentPayload>;
            if (cRes.status === 503 || cJson?.error === 'push_disabled') {
              throw new Error('push_disabled');
            }
            if (!cRes.ok || !cJson?.success) {
              throw new Error(`consent_http_${cRes.status}`);
            }
            return cJson;
          },
          { force },
        ),
        getCached<{
          success?: boolean;
          subscription_count?: number;
          vapid_configured?: boolean;
          error?: string;
        }>(
          PUSH_STATUS_CACHE_KEY,
          PUSH_TTL_MS,
          async () => {
            const sRes = await fetch('/api/push/status');
            const sJson = (await sRes.json()) as {
              success?: boolean;
              subscription_count?: number;
              vapid_configured?: boolean;
              error?: string;
            };
            if (sRes.status === 503 || sJson?.error === 'push_disabled') {
              throw new Error('push_disabled');
            }
            if (!sRes.ok || !sJson?.success) {
              throw new Error(`status_http_${sRes.status}`);
            }
            return sJson;
          },
          { force },
        ),
      ]);
      if ((cJson as any)?.error === 'push_disabled' || (sJson as any)?.error === 'push_disabled') {
        setPushConsent(null);
        setPushStatus(null);
        setPushError(msg.pushDisabled503);
        return;
      }
      setPushConsent({
        has_subscription: Boolean(cJson.has_subscription),
        push_permission_status: String(cJson.push_permission_status ?? 'unknown'),
        consent_timestamp: cJson.consent_timestamp ?? null,
        last_subscription_at_utc: cJson.last_subscription_at_utc ?? null,
      });
      setPushStatus({
        subscription_count: Number(sJson.subscription_count ?? 0),
        vapid_configured: Boolean(sJson.vapid_configured),
      });
      setPushError(null);
    } catch (e: unknown) {
      const em = String((e as { message?: string })?.message ?? e);
      setPushError(em === 'push_disabled' ? msg.pushDisabled503 : em);
      setPushConsent(null);
      setPushStatus(null);
    } finally {
      setPushInfoLoading(false);
    }
  }, [msg.pushDisabled503]);

  const subscribeToPush = React.useCallback(async () => {
    setPushActionLoading(true);
    setPushError(null);
    setPushInfo(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushError(msg.pushNotSupported);
        return;
      }
      const vapidRes = await fetch('/api/push/vapid-public-key');
      const vapidJson = (await vapidRes.json()) as { success?: boolean; publicKey?: string | null; error?: string };
      if (vapidRes.status === 503 || vapidJson?.error === 'push_disabled') {
        setPushError(msg.pushDisabled503);
        return;
      }
      if (!vapidRes.ok || !vapidJson?.success || !vapidJson.publicKey) {
        setPushError(msg.pushVapidMissing);
        return;
      }
      const perm = await Notification.requestPermission();
      setBrowserNotifPermission(perm);
      if (perm !== 'granted') {
        setPushError(lang === 'zh' ? `通知权限：${perm}` : `Notification permission: ${perm}`);
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await reg.update();
      const appServerKey = urlBase64ToUint8Array(vapidJson.publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey as unknown as BufferSource,
      });
      const subJson = sub.toJSON?.() ?? { endpoint: sub.endpoint, keys: (sub as { keys?: { p256dh: string; auth: string } }).keys };
      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...pushAuthHeaders(),
        },
        body: JSON.stringify({
          subscription: subJson,
          push_permission_status: perm,
          consent_timestamp: new Date().toISOString(),
        }),
      });
      const body = (await r.json()) as { success?: boolean; error?: string };
      if (r.status === 401) {
        setPushError(msg.pushUnauthorized);
        return;
      }
      if (r.status === 503 || body?.error === 'push_disabled') {
        setPushError(msg.pushDisabled503);
        return;
      }
      if (!r.ok || !body?.success) {
        setPushError(`subscribe_http_${r.status}`);
        return;
      }
      invalidateCache([PUSH_CONSENT_CACHE_KEY, PUSH_STATUS_CACHE_KEY]);
      setPushInfo(msg.pushOkSubscribed);
      await loadPushInfo(true);
    } catch (e: unknown) {
      setPushError(String((e as { message?: string })?.message ?? e));
    } finally {
      setPushActionLoading(false);
    }
  }, [
    lang,
    loadPushInfo,
    msg.pushDisabled503,
    msg.pushNotSupported,
    msg.pushOkSubscribed,
    msg.pushUnauthorized,
    msg.pushVapidMissing,
    pushApiToken,
  ]);

  const unsubscribeFromPush = React.useCallback(async () => {
    setPushActionLoading(true);
    setPushError(null);
    setPushInfo(null);
    try {
      if (!('serviceWorker' in navigator)) {
        setPushError(msg.pushNotSupported);
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!sub) {
        setPushError(lang === 'zh' ? '当前无浏览器推送订阅。' : 'No active push subscription in this browser.');
        return;
      }
      const endpoint = sub.endpoint;
      const r = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...pushAuthHeaders(),
        },
        body: JSON.stringify({ endpoint }),
      });
      const body = (await r.json()) as { success?: boolean };
      if (r.status === 401) {
        setPushError(msg.pushUnauthorized);
        return;
      }
      if (r.status === 503) {
        setPushError(msg.pushDisabled503);
        return;
      }
      if (!r.ok || !body?.success) {
        setPushError(`unsubscribe_http_${r.status}`);
        return;
      }
      await sub.unsubscribe();
      setBrowserNotifPermission(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
      invalidateCache([PUSH_CONSENT_CACHE_KEY, PUSH_STATUS_CACHE_KEY]);
      setPushInfo(msg.pushOkUnsubscribed);
      await loadPushInfo(true);
    } catch (e: unknown) {
      setPushError(String((e as { message?: string })?.message ?? e));
    } finally {
      setPushActionLoading(false);
    }
  }, [lang, loadPushInfo, msg.pushDisabled503, msg.pushNotSupported, msg.pushOkUnsubscribed, msg.pushUnauthorized, pushApiToken]);

  React.useEffect(() => {
    try {
      if (pushApiToken.trim()) localStorage.setItem('pih.push.apiToken', pushApiToken.trim());
      else localStorage.removeItem('pih.push.apiToken');
    } catch {
      // ignore
    }
  }, [pushApiToken]);

  return {
    pushApiToken,
    setPushApiToken,
    pushInfoLoading,
    pushActionLoading,
    pushError,
    pushInfo,
    pushConsent,
    pushStatus,
    browserNotifPermission,
    loadPushInfo,
    subscribeToPush,
    unsubscribeFromPush,
  };
}
