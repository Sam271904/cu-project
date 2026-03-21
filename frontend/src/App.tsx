import React from 'react';

export function App() {
  type UiLang = 'zh' | 'en';
  type SearchResult = {
    cluster_id: string;
    content_summary: string;
    snippet_text: string;
    cluster_kind?: string;
    level?: 'HIGH' | 'MEDIUM';
    tags: string[];
    personalization_score?: number;
    personalization_reasons?: string[];
  };
  type HomepageCard = {
    id: string;
    cluster_id: string;
    source_type: string;
    source_id: string;
    cluster_kind?: string;
    title: string;
    content_summary: string;
    change_summary: string;
    url: string;
    personalization_score?: number;
    personalization_reasons?: string[];
  };
  type TopicBoardItem = {
    topic: string;
    count: number;
  };
  type HomepageResponse = {
    decision_cards: HomepageCard[];
    topic_board: TopicBoardItem[];
    timeline_feed: HomepageCard[];
  };
  type ClusterTimelineItem = {
    id: string;
    role: string;
    link_confidence: number;
    url: string;
    published_at: string;
    snippet_text: string;
  };
  type ClusterDetailResponse = {
    success: boolean;
    cluster_id: string;
    content_summary: string;
    snippet_text: string;
    tags: string[];
    timeline: ClusterTimelineItem[];
  };
  type DemoStatus = {
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

  function loadStoredView(): 'search' | 'homepage' | 'sources' | 'personalize' | 'push' {
    try {
      const v = localStorage.getItem('pih.view');
      if (v === 'homepage') return 'homepage';
      if (v === 'sources') return 'sources';
      if (v === 'personalize') return 'personalize';
      if (v === 'push') return 'push';
      return 'search';
    } catch {
      return 'search';
    }
  }
  function loadStoredPushApiToken(): string {
    try {
      return localStorage.getItem('pih.push.apiToken') ?? '';
    } catch {
      return '';
    }
  }
  function loadStoredLevel(
    key: string,
    fallback: 'ALL' | 'HIGH' | 'MEDIUM',
  ): 'ALL' | 'HIGH' | 'MEDIUM' {
    try {
      const v = localStorage.getItem(key);
      if (v === 'ALL' || v === 'HIGH' || v === 'MEDIUM') return v;
      return fallback;
    } catch {
      return fallback;
    }
  }
  function loadStoredSearchQuery(): string {
    try {
      return localStorage.getItem('pih.search.query') ?? '';
    } catch {
      return '';
    }
  }
  function loadStoredLang(): UiLang {
    try {
      const v = localStorage.getItem('pih.lang');
      return v === 'en' ? 'en' : 'zh';
    } catch {
      return 'zh';
    }
  }
  function loadStoredDataLang(): UiLang | null {
    try {
      const v = localStorage.getItem('pih.data.lang');
      if (v === 'zh' || v === 'en') return v;
      return null;
    } catch {
      return null;
    }
  }

  const [view, setView] = React.useState<'search' | 'homepage' | 'sources' | 'personalize' | 'push'>(() =>
    loadStoredView(),
  );
  type FeedRow = {
    id: number;
    source_type: string;
    feed_url: string;
    source_id: string | null;
    source_name: string | null;
    enabled: number;
    sort_order: number;
  };
  const [feeds, setFeeds] = React.useState<FeedRow[]>([]);
  const [feedsLoading, setFeedsLoading] = React.useState(false);
  const [feedsError, setFeedsError] = React.useState<string | null>(null);
  const [newFeedUrl, setNewFeedUrl] = React.useState('');
  const [newFeedType, setNewFeedType] = React.useState<'social' | 'tech'>('social');
  const [newFeedName, setNewFeedName] = React.useState('');
  const [collectLoading, setCollectLoading] = React.useState(false);
  const [collectError, setCollectError] = React.useState<string | null>(null);
  const [collectInfo, setCollectInfo] = React.useState<string | null>(null);
  const [bookmarkJson, setBookmarkJson] = React.useState('');
  const [bookmarkLoading, setBookmarkLoading] = React.useState(false);
  const [bookmarkError, setBookmarkError] = React.useState<string | null>(null);
  const [bookmarkInfo, setBookmarkInfo] = React.useState<string | null>(null);
  const [persAllowText, setPersAllowText] = React.useState('');
  const [persDenyText, setPersDenyText] = React.useState('');
  const [persPersonasJson, setPersPersonasJson] = React.useState('[]');
  const [persLoading, setPersLoading] = React.useState(false);
  const [persError, setPersError] = React.useState<string | null>(null);
  const [persOk, setPersOk] = React.useState<string | null>(null);
  const [pushApiToken, setPushApiToken] = React.useState(() => loadStoredPushApiToken());
  const [pushInfoLoading, setPushInfoLoading] = React.useState(false);
  const [pushActionLoading, setPushActionLoading] = React.useState(false);
  const [pushError, setPushError] = React.useState<string | null>(null);
  const [pushInfo, setPushInfo] = React.useState<string | null>(null);
  type PushConsentPayload = {
    has_subscription: boolean;
    push_permission_status: string;
    consent_timestamp: string | null;
    last_subscription_at_utc: string | null;
  };
  const [pushConsent, setPushConsent] = React.useState<PushConsentPayload | null>(null);
  const [pushStatus, setPushStatus] = React.useState<{
    subscription_count: number;
    vapid_configured: boolean;
  } | null>(null);
  const [browserNotifPermission, setBrowserNotifPermission] = React.useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const [lang, setLang] = React.useState<UiLang>(() => loadStoredLang());
  const [dataLang, setDataLang] = React.useState<UiLang | null>(() => loadStoredDataLang());
  const [q, setQ] = React.useState(() => loadStoredSearchQuery());
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searchLevelFilter, setSearchLevelFilter] = React.useState<'ALL' | 'HIGH' | 'MEDIUM'>(() =>
    loadStoredLevel('pih.search.levelFilter', 'ALL'),
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [seedLoading, setSeedLoading] = React.useState(false);
  const [seedError, setSeedError] = React.useState<string | null>(null);
  const [seedInfo, setSeedInfo] = React.useState<string | null>(null);
  const [homepageLoading, setHomepageLoading] = React.useState(false);
  const [homepageError, setHomepageError] = React.useState<string | null>(null);
  const [homepageLevelFilter, setHomepageLevelFilter] = React.useState<'ALL' | 'HIGH' | 'MEDIUM'>(() =>
    loadStoredLevel('pih.homepage.levelFilter', 'ALL'),
  );
  const [homepage, setHomepage] = React.useState<HomepageResponse>({
    decision_cards: [],
    topic_board: [],
    timeline_feed: [],
  });
  const [selectedClusterId, setSelectedClusterId] = React.useState<string | null>(null);
  const [clusterDetailLoading, setClusterDetailLoading] = React.useState(false);
  const [clusterDetailError, setClusterDetailError] = React.useState<string | null>(null);
  const [clusterDetail, setClusterDetail] = React.useState<ClusterDetailResponse | null>(null);
  const [timelineRoleFilter, setTimelineRoleFilter] = React.useState<'all' | 'supports' | 'contradicts' | 'context'>(
    'all',
  );
  const [demoStatusLoading, setDemoStatusLoading] = React.useState(false);
  const [demoStatusError, setDemoStatusError] = React.useState<string | null>(null);
  const [demoStatus, setDemoStatus] = React.useState<DemoStatus | null>(null);
  const t = {
    title: lang === 'zh' ? '个人信息中台（MVP）' : 'Personal Information Hub (MVP)',
    searchTab: lang === 'zh' ? '知识搜索' : 'Knowledge Search',
    homepageTab: lang === 'zh' ? '首页' : 'Homepage',
    sourcesTab: lang === 'zh' ? '信源' : 'Sources',
    personalizeTab: lang === 'zh' ? '个性化' : 'Personalize',
    pushTab: lang === 'zh' ? '推送' : 'Push',
    persTitle: lang === 'zh' ? '个性化规则' : 'Personalization',
    persAllowLabel: lang === 'zh' ? '偏好关键词（命中加分，每行一条）' : 'Boost keywords (one per line)',
    persDenyLabel: lang === 'zh' ? '屏蔽关键词（命中则隐藏条目）' : 'Hide keywords (one per line)',
    persPersonasLabel: lang === 'zh' ? '主题 Persona（JSON 数组）' : 'Topic personas (JSON array)',
    persSave: lang === 'zh' ? '保存规则' : 'Save rules',
    persSaving: lang === 'zh' ? '保存中…' : 'Saving…',
    persSavedOk: lang === 'zh' ? '已保存' : 'Saved',
    persJsonErr: lang === 'zh' ? 'Persona JSON 无效' : 'Invalid persona JSON',
    persWhy: lang === 'zh' ? '匹配' : 'Match',
    persScore: lang === 'zh' ? '分' : 'pts',
    like: lang === 'zh' ? '赞' : 'Like',
    dislike: lang === 'zh' ? '踩' : 'Dislike',
    feedbackClear: lang === 'zh' ? '清除态度' : 'Clear',
    saveCluster: lang === 'zh' ? '收藏' : 'Save',
    unsaveCluster: lang === 'zh' ? '取消收藏' : 'Unsave',
    sourcesTitle: lang === 'zh' ? 'RSS 信源' : 'RSS feeds',
    sourcesHint:
      lang === 'zh'
        ? '添加订阅地址后，可一键采集（走与 Seed 相同管线）。同一 URL 全局唯一。'
        : 'Add feed URLs, then run a full pipeline collect. Each URL is unique.',
    feedUrl: lang === 'zh' ? 'Feed URL' : 'Feed URL',
    feedType: lang === 'zh' ? '类型' : 'Type',
    feedNameOpt: lang === 'zh' ? '显示名（可选）' : 'Label (optional)',
    social: lang === 'zh' ? '社媒' : 'Social',
    tech: lang === 'zh' ? '技术' : 'Tech',
    addFeed: lang === 'zh' ? '添加' : 'Add',
    removeFeed: lang === 'zh' ? '删除' : 'Remove',
    collectStored: lang === 'zh' ? '按信源采集' : 'Collect from sources',
    collectStoredRunning: lang === 'zh' ? '采集中…' : 'Collecting…',
    refreshFeeds: lang === 'zh' ? '刷新列表' : 'Refresh list',
    noFeeds: lang === 'zh' ? '暂无信源，请先添加 RSS URL。' : 'No feeds yet. Add an RSS URL.',
    bookmarkImportTitle: lang === 'zh' ? '导入书签（JSON）' : 'Import bookmarks (JSON)',
    bookmarkImportHint:
      lang === 'zh'
        ? '支持数组或 { "items": [...] }。每项：url（必填）、title、folder、note、addedAt（ISO 可选）。最多 500 条，http(s) 有效。'
        : 'Array or `{ "items": [...] }`. Fields: url (required), title, folder, note, addedAt (ISO optional). Max 500, http(s) only.',
    bookmarkPlaceholder:
      lang === 'zh'
        ? '[\n  { "url": "https://example.com", "title": "示例", "folder": "稍后读", "note": "备注" }\n]'
        : '[\n  { "url": "https://example.com", "title": "Example", "folder": "Read later", "note": "Why" }\n]',
    bookmarkImport: lang === 'zh' ? '导入并跑管线' : 'Import & run pipeline',
    bookmarkImporting: lang === 'zh' ? '导入中…' : 'Importing…',
    bookmarkJsonInvalid: lang === 'zh' ? 'JSON 格式无效' : 'Invalid JSON',
    bookmarkJsonNotArray: lang === 'zh' ? '需要 JSON 数组或含 items 数组的对象' : 'Expected a JSON array or an object with an items array',
    langZh: lang === 'zh' ? '中文' : 'Chinese',
    langEn: 'English',
    clearState: lang === 'zh' ? '清空本地状态' : 'Clear Local State',
    seed1: lang === 'zh' ? 'Seed 测试数据（1轮）' : 'Seed test data (1 round)',
    seed2: lang === 'zh' ? 'Seed + 漂移验证（2轮）' : 'Seed + drift verify (2 rounds)',
    prepareDemo: lang === 'zh' ? '一键演示准备' : 'Prepare Demo',
    demoStatus: lang === 'zh' ? '演示状态' : 'Demo Status',
    refreshStatus: lang === 'zh' ? '刷新状态' : 'Refresh Status',
    noStatus: lang === 'zh' ? '暂无状态' : 'No status',
    loading: lang === 'zh' ? '加载中...' : 'Loading...',
    search: lang === 'zh' ? '搜索' : 'Search',
    searching: lang === 'zh' ? '搜索中...' : 'Searching...',
    level: lang === 'zh' ? '等级' : 'Level',
    placeholder: lang === 'zh' ? '输入关键词，例如 Social / Tech' : 'Type keywords, e.g. Social / Tech',
    hit: lang === 'zh' ? '命中' : 'Hits',
    noResult: lang === 'zh' ? '暂无结果' : 'No results',
    inputTip: lang === 'zh' ? '请输入关键词开始搜索' : 'Type a keyword to search',
    detail: lang === 'zh' ? '查看详情' : 'View Detail',
    close: lang === 'zh' ? '关闭' : 'Close',
    source: lang === 'zh' ? '跳转来源' : 'Open Source',
    copy: lang === 'zh' ? '复制片段' : 'Copy Snippet',
    topicNone: lang === 'zh' ? '暂无主题' : 'No topics',
    refreshHomepage: lang === 'zh' ? '刷新 Homepage' : 'Refresh Homepage',
    viewSource: lang === 'zh' ? '查看来源' : 'View Source',
    evidenceNone: lang === 'zh' ? '当前过滤条件下暂无 evidence links' : 'No evidence links under current filter',
    seeding: lang === 'zh' ? '生成中...' : 'Seeding...',
    preparing: lang === 'zh' ? '准备中...' : 'Preparing...',
    privacyPass: lang === 'zh' ? '通过' : 'PASS',
    privacyFail: lang === 'zh' ? '失败' : 'FAIL',
    na: lang === 'zh' ? '无' : 'n/a',
    clusterDetail: lang === 'zh' ? '聚类详情' : 'Cluster Detail',
    timelineEvidence: lang === 'zh' ? '时间线 / 证据' : 'Timeline / Evidence',
    decisionCards: lang === 'zh' ? '决策卡片' : 'Decision Cards',
    topicBoard: lang === 'zh' ? '主题板' : 'Topic Board',
    timeline: lang === 'zh' ? '时间线' : 'Timeline',
    demoPrepared: lang === 'zh' ? '演示已准备' : 'demo prepared',
    scenario: lang === 'zh' ? '场景' : 'scenario',
    round: lang === 'zh' ? '轮次' : 'round',
    kinds: lang === 'zh' ? '类型统计' : 'kinds',
    langDataMismatch:
      lang === 'zh'
        ? '检测到界面语言与当前数据语言不一致，建议重新生成数据以保持内容语言一致。'
        : 'UI language differs from current data language. Re-seed is recommended for consistent content language.',
    rebuildData: lang === 'zh' ? '按当前语言重建数据（2轮）' : 'Rebuild data in current language (2 rounds)',
    persReload: lang === 'zh' ? '重新加载' : 'Reload',
    persHint:
      lang === 'zh'
        ? '保存后首页与搜索会按分数重排；屏蔽词命中的条目将不再出现。'
        : 'After save, homepage and search reorder by score; denied keywords hide items.',
    pushTitle: lang === 'zh' ? '浏览器推送（同意与订阅）' : 'Web Push (consent & subscribe)',
    pushHint:
      lang === 'zh'
        ? '需 HTTPS 或 localhost；服务端需 PIH_PUSH_ENABLED=true 且配置 VAPID。若启用 PIH_PUSH_API_TOKEN，请在下方填写 Token（仅存于本机浏览器）。'
        : 'Requires HTTPS or localhost; server needs PIH_PUSH_ENABLED=true and VAPID keys. If PIH_PUSH_API_TOKEN is set, paste the token below (stored locally only).',
    pushTokenLabel: lang === 'zh' ? 'Push API Token（可选）' : 'Push API token (optional)',
    pushTokenPlaceholder: lang === 'zh' ? '与后端 PIH_PUSH_API_TOKEN 一致时填写' : 'Match server PIH_PUSH_API_TOKEN when required',
    pushRefresh: lang === 'zh' ? '刷新状态' : 'Refresh',
    pushSubscribe: lang === 'zh' ? '请求通知权限并订阅' : 'Enable notifications & subscribe',
    pushUnsubscribe: lang === 'zh' ? '取消订阅' : 'Unsubscribe',
    pushNotSupported: lang === 'zh' ? '当前浏览器不支持 Service Worker / Push。' : 'Service Worker / Push not supported.',
    pushDisabled503: lang === 'zh' ? '推送 API 未启用（503 push_disabled）。' : 'Push APIs disabled (503 push_disabled).',
    pushUnauthorized: lang === 'zh' ? '401：缺少或错误的 Push API Token。' : '401: missing or invalid Push API token.',
    pushVapidMissing: lang === 'zh' ? '服务端未配置 VAPID 公钥。' : 'VAPID public key missing on server.',
    pushOkSubscribed: lang === 'zh' ? '已订阅并写入服务端。' : 'Subscribed and saved on server.',
    pushOkUnsubscribed: lang === 'zh' ? '已取消订阅。' : 'Unsubscribed.',
    pushPermBrowser: lang === 'zh' ? '浏览器通知权限' : 'Browser notification permission',
    pushPermServer: lang === 'zh' ? '服务端记录' : 'Server record',
    pushHasSub: lang === 'zh' ? '库中有订阅' : 'Has subscription row',
    pushSubCount: lang === 'zh' ? '订阅行数' : 'Subscription rows',
    pushVapidOk: lang === 'zh' ? 'VAPID 已配置' : 'VAPID configured',
    pushVapidNo: lang === 'zh' ? 'VAPID 未配置' : 'VAPID not configured',
  };

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function pushAuthHeaders(): Record<string, string> {
    const t = pushApiToken.trim();
    if (!t) return {};
    return { Authorization: `Bearer ${t}` };
  }

  async function loadPushInfo() {
    setPushInfoLoading(true);
    setPushError(null);
    setPushInfo(null);
    if (typeof Notification !== 'undefined') {
      setBrowserNotifPermission(Notification.permission);
    }
    try {
      const [cRes, sRes] = await Promise.all([fetch('/api/push/consent'), fetch('/api/push/status')]);
      const cJson = (await cRes.json()) as { success?: boolean; error?: string } & Partial<PushConsentPayload>;
      const sJson = (await sRes.json()) as {
        success?: boolean;
        subscription_count?: number;
        vapid_configured?: boolean;
        error?: string;
      };
      if (cRes.status === 503 || cJson?.error === 'push_disabled') {
        setPushConsent(null);
        setPushStatus(null);
        setPushError(t.pushDisabled503);
        return;
      }
      if (sRes.status === 503 || sJson?.error === 'push_disabled') {
        setPushConsent(null);
        setPushStatus(null);
        setPushError(t.pushDisabled503);
        return;
      }
      let errMsg: string | null = null;
      if (!cRes.ok || !cJson?.success) {
        errMsg = `consent_http_${cRes.status}`;
        setPushConsent(null);
      } else {
        setPushConsent({
          has_subscription: Boolean(cJson.has_subscription),
          push_permission_status: String(cJson.push_permission_status ?? 'unknown'),
          consent_timestamp: cJson.consent_timestamp ?? null,
          last_subscription_at_utc: cJson.last_subscription_at_utc ?? null,
        });
      }
      if (!sRes.ok || !sJson?.success) {
        errMsg = errMsg ?? `status_http_${sRes.status}`;
        setPushStatus(null);
      } else {
        setPushStatus({
          subscription_count: Number(sJson.subscription_count ?? 0),
          vapid_configured: Boolean(sJson.vapid_configured),
        });
      }
      setPushError(errMsg);
    } catch (e: unknown) {
      setPushError(String((e as { message?: string })?.message ?? e));
      setPushConsent(null);
      setPushStatus(null);
    } finally {
      setPushInfoLoading(false);
    }
  }

  async function subscribeToPush() {
    setPushActionLoading(true);
    setPushError(null);
    setPushInfo(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushError(t.pushNotSupported);
        return;
      }
      const vapidRes = await fetch('/api/push/vapid-public-key');
      const vapidJson = (await vapidRes.json()) as { success?: boolean; publicKey?: string | null; error?: string };
      if (vapidRes.status === 503 || vapidJson?.error === 'push_disabled') {
        setPushError(t.pushDisabled503);
        return;
      }
      if (!vapidRes.ok || !vapidJson?.success || !vapidJson.publicKey) {
        setPushError(t.pushVapidMissing);
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
        applicationServerKey: appServerKey,
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
        setPushError(t.pushUnauthorized);
        return;
      }
      if (r.status === 503 || body?.error === 'push_disabled') {
        setPushError(t.pushDisabled503);
        return;
      }
      if (!r.ok || !body?.success) {
        setPushError(`subscribe_http_${r.status}`);
        return;
      }
      setPushInfo(t.pushOkSubscribed);
      await loadPushInfo();
    } catch (e: unknown) {
      setPushError(String((e as { message?: string })?.message ?? e));
    } finally {
      setPushActionLoading(false);
    }
  }

  async function unsubscribeFromPush() {
    setPushActionLoading(true);
    setPushError(null);
    setPushInfo(null);
    try {
      if (!('serviceWorker' in navigator)) {
        setPushError(t.pushNotSupported);
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
        setPushError(t.pushUnauthorized);
        return;
      }
      if (r.status === 503) {
        setPushError(t.pushDisabled503);
        return;
      }
      if (!r.ok || !body?.success) {
        setPushError(`unsubscribe_http_${r.status}`);
        return;
      }
      await sub.unsubscribe();
      setBrowserNotifPermission(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
      setPushInfo(t.pushOkUnsubscribed);
      await loadPushInfo();
    } catch (e: unknown) {
      setPushError(String((e as { message?: string })?.message ?? e));
    } finally {
      setPushActionLoading(false);
    }
  }

  async function search() {
    const query = q.trim();
    if (!query) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}`);
      const json = (await res.json()) as { results?: SearchResult[] };
      if (!res.ok) {
        setError(`search_failed_http_${res.status}`);
        setResults([]);
        return;
      }
      setResults(Array.isArray(json.results) ? json.results : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function seedTestData(scenario: 'single_round' | 'two_rounds' = 'single_round') {
    setSeedLoading(true);
    setSeedError(null);
    setSeedInfo(null);
    try {
      const res = await fetch('/api/seed/test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ scenario, lang }),
      });
      const json = (await res.json()) as any;
      if (!res.ok || !json?.success) {
        setSeedError(`seed_failed_http_${res.status}`);
        return;
      }
      const summary = json?.cluster_kind_summary ?? {};
      setDataLang(lang);
      setSeedInfo(
        `${t.scenario}=${json?.scenario ?? scenario}, ${t.round}=${json?.round_id}, ${t.kinds}=${JSON.stringify(summary)}`,
      );
      // After seeding, if no query is set, default to "Seed" so the page is immediately useful.
      if (!q.trim()) {
        setQ('Seed');
        // Wait for state update would be non-deterministic; just call search with the intended value.
        setTimeout(() => {
          void (async () => {
            const res2 = await fetch(`/api/knowledge/search?q=${encodeURIComponent('Seed')}`);
            const j2 = (await res2.json()) as { results?: SearchResult[] };
            setResults(Array.isArray(j2.results) ? j2.results : []);
          })();
        }, 0);
      }
      await loadHomepage();
    } catch (e: any) {
      setSeedError(String(e?.message ?? e));
    } finally {
      setSeedLoading(false);
    }
  }

  async function loadHomepage() {
    setHomepageLoading(true);
    setHomepageError(null);
    try {
      const res = await fetch('/api/homepage');
      const json = (await res.json()) as HomepageResponse;
      if (!res.ok) {
        setHomepageError(`homepage_failed_http_${res.status}`);
        setHomepage({ decision_cards: [], topic_board: [], timeline_feed: [] });
        return;
      }
      setHomepage({
        decision_cards: Array.isArray(json.decision_cards) ? json.decision_cards : [],
        topic_board: Array.isArray(json.topic_board) ? json.topic_board : [],
        timeline_feed: Array.isArray(json.timeline_feed) ? json.timeline_feed : [],
      });
    } catch (e: any) {
      setHomepageError(String(e?.message ?? e));
      setHomepage({ decision_cards: [], topic_board: [], timeline_feed: [] });
    } finally {
      setHomepageLoading(false);
    }
  }

  async function loadDemoStatus() {
    setDemoStatusLoading(true);
    setDemoStatusError(null);
    try {
      const res = await fetch('/api/demo/status');
      const json = (await res.json()) as DemoStatus;
      if (!res.ok || !json?.success) {
        setDemoStatusError(`demo_status_failed_http_${res.status}`);
        setDemoStatus(null);
        return;
      }
      setDemoStatus(json);
    } catch (e: any) {
      setDemoStatusError(String(e?.message ?? e));
      setDemoStatus(null);
    } finally {
      setDemoStatusLoading(false);
    }
  }

  async function loadFeeds() {
    setFeedsLoading(true);
    setFeedsError(null);
    try {
      const res = await fetch('/api/feeds');
      const json = (await res.json()) as { success?: boolean; feeds?: FeedRow[] };
      if (!res.ok || !json?.success) {
        setFeedsError(`feeds_failed_http_${res.status}`);
        setFeeds([]);
        return;
      }
      setFeeds(Array.isArray(json.feeds) ? json.feeds : []);
    } catch (e: any) {
      setFeedsError(String(e?.message ?? e));
      setFeeds([]);
    } finally {
      setFeedsLoading(false);
    }
  }

  async function addFeedRow() {
    const feed_url = newFeedUrl.trim();
    if (!feed_url) return;
    setFeedsError(null);
    setFeedsLoading(true);
    try {
      const res = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          source_type: newFeedType,
          feed_url,
          source_name: newFeedName.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (res.status === 409) {
        setFeedsError(lang === 'zh' ? '该 URL 已存在' : 'This URL is already registered');
        return;
      }
      if (!res.ok || !json?.success) {
        setFeedsError(`add_feed_failed_${res.status}`);
        return;
      }
      setNewFeedUrl('');
      setNewFeedName('');
      await loadFeeds();
    } catch (e: any) {
      setFeedsError(String(e?.message ?? e));
    } finally {
      setFeedsLoading(false);
    }
  }

  async function deleteFeedRow(id: number) {
    setFeedsError(null);
    try {
      const res = await fetch(`/api/feeds?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' });
      const json = (await res.json()) as { success?: boolean };
      if (!res.ok || !json?.success) {
        setFeedsError(`delete_feed_failed_${res.status}`);
        return;
      }
      await loadFeeds();
    } catch (e: any) {
      setFeedsError(String(e?.message ?? e));
    }
  }

  function parseBookmarkPayload(text: string): unknown[] | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)) {
        return (parsed as { items: unknown[] }).items;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function importBookmarksFromJson() {
    setBookmarkLoading(true);
    setBookmarkError(null);
    setBookmarkInfo(null);
    try {
      const items = parseBookmarkPayload(bookmarkJson);
      if (items === null) {
        setBookmarkError(t.bookmarkJsonInvalid);
        return;
      }
      if (!Array.isArray(items)) {
        setBookmarkError(t.bookmarkJsonNotArray);
        return;
      }
      const res = await fetch('/api/import/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ items, lang }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        inserted?: number;
        skipped?: number;
        round_id?: number;
      };
      if (res.status === 400 && json?.error === 'no_valid_bookmarks') {
        setBookmarkError(lang === 'zh' ? '没有有效的 http(s) 链接' : 'No valid http(s) URLs');
        return;
      }
      if (!res.ok || !json?.success) {
        setBookmarkError(`bookmark_import_failed_${res.status}`);
        return;
      }
      setBookmarkInfo(
        lang === 'zh'
          ? `已导入 ${json.inserted} 条（跳过 ${json.skipped ?? 0}），轮次 ${json.round_id}`
          : `Imported ${json.inserted} (skipped ${json.skipped ?? 0}), round ${json.round_id}`,
      );
      setDataLang(lang);
      await Promise.all([loadHomepage(), loadDemoStatus()]);
    } catch (e: any) {
      setBookmarkError(String(e?.message ?? e));
    } finally {
      setBookmarkLoading(false);
    }
  }

  async function collectFromStoredFeeds() {
    setCollectLoading(true);
    setCollectError(null);
    setCollectInfo(null);
    try {
      const res = await fetch('/api/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ useStoredFeeds: true, lang }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; round_id?: number; ingested?: { social: number; tech: number } };
      if (res.status === 400 && json?.error === 'no_feeds_configured') {
        setCollectError(lang === 'zh' ? '未配置任何信源' : 'No feeds configured');
        return;
      }
      if (!res.ok || !json?.success) {
        setCollectError(`collect_failed_http_${res.status}`);
        return;
      }
      setCollectInfo(
        lang === 'zh'
          ? `完成：轮次 ${json.round_id}，社媒 ${json.ingested?.social ?? 0}，技术 ${json.ingested?.tech ?? 0}`
          : `Done: round ${json.round_id}, social ${json.ingested?.social ?? 0}, tech ${json.ingested?.tech ?? 0}`,
      );
      setDataLang(lang);
      await Promise.all([loadHomepage(), loadDemoStatus(), loadFeeds()]);
    } catch (e: any) {
      setCollectError(String(e?.message ?? e));
    } finally {
      setCollectLoading(false);
    }
  }

  const [feedbackByCluster, setFeedbackByCluster] = React.useState<
    Record<string, { sentiment: number; saved: boolean }>
  >({});

  async function loadFeedbackSummary() {
    try {
      const res = await fetch('/api/personalization');
      const j = (await res.json()) as {
        success?: boolean;
        feedback?: Array<{ cluster_id: string; sentiment: number; saved: number | boolean }>;
      };
      if (!res.ok || !j?.success) return;
      const m: Record<string, { sentiment: number; saved: boolean }> = {};
      for (const row of j.feedback ?? []) {
        if (!row?.cluster_id) continue;
        m[row.cluster_id] = { sentiment: Number(row.sentiment), saved: Boolean(row.saved) };
      }
      setFeedbackByCluster(m);
    } catch {
      // ignore
    }
  }

  async function loadPersonalizationForm() {
    setPersLoading(true);
    setPersError(null);
    setPersOk(null);
    try {
      const res = await fetch('/api/personalization');
      const j = (await res.json()) as {
        success?: boolean;
        error?: string;
        keywords?: Array<{ mode: string; keyword: string }>;
        personas?: Array<{ name: string; keywords: string[]; weight: number }>;
      };
      if (!res.ok || !j?.success) {
        setPersError(j?.error ?? `load_personalization_${res.status}`);
        return;
      }
      const allow = (j.keywords ?? []).filter((k) => k.mode === 'allow').map((k) => k.keyword);
      const deny = (j.keywords ?? []).filter((k) => k.mode === 'deny').map((k) => k.keyword);
      setPersAllowText(allow.join('\n'));
      setPersDenyText(deny.join('\n'));
      setPersPersonasJson(JSON.stringify((j.personas ?? []).map((p) => ({ name: p.name, keywords: p.keywords, weight: p.weight })), null, 2));
    } catch (e: any) {
      setPersError(String(e?.message ?? e));
    } finally {
      setPersLoading(false);
    }
  }

  async function savePersonalizationForm() {
    setPersLoading(true);
    setPersError(null);
    setPersOk(null);
    try {
      const allowLines = persAllowText
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
      const denyLines = persDenyText
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
      const keywords = [
        ...allowLines.map((keyword) => ({ mode: 'allow' as const, keyword })),
        ...denyLines.map((keyword) => ({ mode: 'deny' as const, keyword })),
      ];
      let personas: Array<{ name: string; keywords: string[]; weight: number }>;
      try {
        const parsed = JSON.parse(persPersonasJson) as unknown;
        if (!Array.isArray(parsed)) throw new Error('not_array');
        personas = parsed.map((p: any) => ({
          name: String(p?.name ?? '').trim() || 'persona',
          keywords: Array.isArray(p?.keywords) ? p.keywords.map((x: unknown) => String(x).trim()).filter(Boolean) : [],
          weight: typeof p?.weight === 'number' && Number.isFinite(p.weight) ? p.weight : 1,
        }));
      } catch {
        setPersError(t.persJsonErr);
        return;
      }
      const res = await fetch('/api/personalization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ keywords, personas }),
      });
      const j = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !j?.success) {
        setPersError(j?.error ?? `save_personalization_${res.status}`);
        return;
      }
      setPersOk(t.persSavedOk);
      await Promise.all([loadHomepage(), loadFeedbackSummary()]);
      if (q.trim()) await search();
    } catch (e: any) {
      setPersError(String(e?.message ?? e));
    } finally {
      setPersLoading(false);
    }
  }

  async function postClusterFeedback(clusterId: string, patch: { sentiment?: -1 | 0 | 1; saved?: boolean }) {
    const body: { cluster_id: string; sentiment?: number; saved?: boolean } = { cluster_id: clusterId };
    if (patch.sentiment !== undefined) body.sentiment = patch.sentiment;
    if (patch.saved !== undefined) body.saved = patch.saved;
    try {
      const res = await fetch('/api/personalization/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { success?: boolean };
      if (!res.ok || !j?.success) return;
      await Promise.all([loadHomepage(), loadFeedbackSummary()]);
      if (q.trim()) await search();
    } catch {
      // ignore
    }
  }

  function personalizationReasonsAndFeedbackRow(
    clusterId: string,
    personalization_reasons: string[] | undefined,
    marginTop = 8,
  ) {
    const reasons = Array.isArray(personalization_reasons) ? personalization_reasons : [];
    const hasReasons = reasons.length > 0;
    return (
      <>
        {hasReasons ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop }}>
            {reasons.map((w, idx) => (
              <span
                key={`${idx}_${w}`}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#f1f5f9',
                  color: '#475569',
                }}
              >
                {w}
              </span>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 6, marginTop: hasReasons ? 6 : marginTop, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void postClusterFeedback(clusterId, { sentiment: 1 })}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #ddd',
              cursor: 'pointer',
              fontSize: 12,
              background: feedbackByCluster[clusterId]?.sentiment === 1 ? '#dcfce7' : '#fff',
            }}
          >
            {t.like}
          </button>
          <button
            type="button"
            onClick={() => void postClusterFeedback(clusterId, { sentiment: -1 })}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #ddd',
              cursor: 'pointer',
              fontSize: 12,
              background: feedbackByCluster[clusterId]?.sentiment === -1 ? '#fee2e2' : '#fff',
            }}
          >
            {t.dislike}
          </button>
          <button
            type="button"
            onClick={() => void postClusterFeedback(clusterId, { sentiment: 0 })}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12 }}
          >
            {t.feedbackClear}
          </button>
          <button
            type="button"
            onClick={() =>
              void postClusterFeedback(clusterId, { saved: !(feedbackByCluster[clusterId]?.saved ?? false) })
            }
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #ddd',
              cursor: 'pointer',
              fontSize: 12,
              background: feedbackByCluster[clusterId]?.saved ? '#e0e7ff' : '#fff',
            }}
          >
            {feedbackByCluster[clusterId]?.saved ? t.unsaveCluster : t.saveCluster}
          </button>
        </div>
      </>
    );
  }

  React.useEffect(() => {
    void loadHomepage();
    void loadDemoStatus();
    void loadFeedbackSummary();
  }, []);

  React.useEffect(() => {
    if (view === 'sources') void loadFeeds();
  }, [view]);

  React.useEffect(() => {
    if (view === 'personalize') void loadPersonalizationForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load form when tab opens only
  }, [view]);

  React.useEffect(() => {
    if (view === 'push') void loadPushInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh push/consent when tab opens
  }, [view]);

  React.useEffect(() => {
    try {
      if (pushApiToken.trim()) localStorage.setItem('pih.push.apiToken', pushApiToken.trim());
      else localStorage.removeItem('pih.push.apiToken');
    } catch {
      // ignore
    }
  }, [pushApiToken]);

  React.useEffect(() => {
    try {
      localStorage.setItem('pih.view', view);
    } catch {
      // ignore storage errors
    }
  }, [view]);

  React.useEffect(() => {
    try {
      localStorage.setItem('pih.search.levelFilter', searchLevelFilter);
    } catch {
      // ignore storage errors
    }
  }, [searchLevelFilter]);

  React.useEffect(() => {
    try {
      localStorage.setItem('pih.homepage.levelFilter', homepageLevelFilter);
    } catch {
      // ignore storage errors
    }
  }, [homepageLevelFilter]);

  React.useEffect(() => {
    try {
      localStorage.setItem('pih.search.query', q);
    } catch {
      // ignore storage errors
    }
  }, [q]);

  React.useEffect(() => {
    try {
      localStorage.setItem('pih.lang', lang);
    } catch {
      // ignore storage errors
    }
  }, [lang]);

  React.useEffect(() => {
    try {
      if (dataLang) localStorage.setItem('pih.data.lang', dataLang);
      else localStorage.removeItem('pih.data.lang');
    } catch {
      // ignore storage errors
    }
  }, [dataLang]);

  React.useEffect(() => {
    if (!q.trim()) return;
    // Restore context on reload: auto-run search once when persisted query exists.
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function levelFromClusterKind(clusterKind?: string): 'HIGH' | 'MEDIUM' {
    return clusterKind === 'event_update' ? 'HIGH' : 'MEDIUM';
  }

  function formatPublishedAt(input: string): string {
    if (!input) return '';
    const t = Date.parse(input);
    if (Number.isNaN(t)) return input;
    return new Date(t).toLocaleString();
  }

  async function copyText(text: string) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // fallback below
    }

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
  }

  async function loadClusterDetail(clusterId: string) {
    setSelectedClusterId(clusterId);
    setClusterDetailLoading(true);
    setClusterDetailError(null);
    setTimelineRoleFilter('all');
    try {
      const res = await fetch(`/api/knowledge/cluster?cluster_id=${encodeURIComponent(clusterId)}`);
      const json = (await res.json()) as ClusterDetailResponse;
      if (!res.ok || !json?.success) {
        setClusterDetailError(`cluster_detail_failed_http_${res.status}`);
        setClusterDetail(null);
        return;
      }
      setClusterDetail(json);
    } catch (e: any) {
      setClusterDetailError(String(e?.message ?? e));
      setClusterDetail(null);
    } finally {
      setClusterDetailLoading(false);
    }
  }

  function resetLocalState() {
    try {
      localStorage.removeItem('pih.view');
      localStorage.removeItem('pih.search.levelFilter');
      localStorage.removeItem('pih.homepage.levelFilter');
      localStorage.removeItem('pih.search.query');
      localStorage.removeItem('pih.lang');
      localStorage.removeItem('pih.data.lang');
    } catch {
      // ignore storage errors
    }

    setView('search');
    setQ('');
    setResults([]);
    setSearchLevelFilter('ALL');
    setHomepageLevelFilter('ALL');
    setSelectedClusterId(null);
    setClusterDetail(null);
    setClusterDetailError(null);
    setLang('zh');
    setDataLang(null);
  }

  async function prepareDemo() {
    setSeedLoading(true);
    setSeedError(null);
    setSeedInfo(null);
    try {
      const res = await fetch('/api/seed/test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ scenario: 'two_rounds', lang }),
      });
      const json = (await res.json()) as any;
      if (!res.ok || !json?.success) {
        setSeedError(`prepare_demo_failed_http_${res.status}`);
        return;
      }
      setSeedInfo(
        `${t.demoPrepared}: ${t.round}=${json?.round_id}, ${t.kinds}=${JSON.stringify(json?.cluster_kind_summary ?? {})}`,
      );
      setDataLang(lang);
      setQ('Seed');
      await Promise.all([loadHomepage(), loadDemoStatus()]);
      // Trigger search result refresh after query set.
      const res2 = await fetch(`/api/knowledge/search?q=${encodeURIComponent('Seed')}`);
      const j2 = (await res2.json()) as { results?: SearchResult[] };
      setResults(Array.isArray(j2.results) ? j2.results : []);
    } catch (e: any) {
      setSeedError(String(e?.message ?? e));
    } finally {
      setSeedLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial', padding: 16 }}>
      <h2 style={{ margin: '0 0 12px' }}>{t.title}</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          data-testid="tab-search"
          onClick={() => setView('search')}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #ddd',
            cursor: 'pointer',
            background: view === 'search' ? '#eef6ff' : '#fff',
          }}
        >
          {t.searchTab}
        </button>
        <button
          type="button"
          data-testid="tab-homepage"
          onClick={() => setView('homepage')}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #ddd',
            cursor: 'pointer',
            background: view === 'homepage' ? '#eef6ff' : '#fff',
          }}
        >
          {t.homepageTab}
        </button>
        <button
          type="button"
          data-testid="tab-sources"
          onClick={() => setView('sources')}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #ddd',
            cursor: 'pointer',
            background: view === 'sources' ? '#eef6ff' : '#fff',
          }}
        >
          {t.sourcesTab}
        </button>
        <button
          type="button"
          data-testid="tab-personalize"
          onClick={() => setView('personalize')}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #ddd',
            cursor: 'pointer',
            background: view === 'personalize' ? '#eef6ff' : '#fff',
          }}
        >
          {t.personalizeTab}
        </button>
        <button
          type="button"
          data-testid="tab-push"
          onClick={() => setView('push')}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #ddd',
            cursor: 'pointer',
            background: view === 'push' ? '#eef6ff' : '#fff',
          }}
        >
          {t.pushTab}
        </button>
        <button
          onClick={() => setLang('zh')}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #ddd',
            cursor: 'pointer',
            background: lang === 'zh' ? '#eef6ff' : '#fff',
          }}
        >
          {t.langZh}
        </button>
        <button
          onClick={() => setLang('en')}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #ddd',
            cursor: 'pointer',
            background: lang === 'en' ? '#eef6ff' : '#fff',
          }}
        >
          {t.langEn}
        </button>
        <button
          type="button"
          data-testid="btn-clear-state"
          onClick={resetLocalState}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #ddd',
            cursor: 'pointer',
            background: '#fff',
            marginLeft: 'auto',
          }}
        >
          {t.clearState}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button
          type="button"
          data-testid="btn-seed-single"
          onClick={() => void seedTestData('single_round')}
          disabled={seedLoading}
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: seedLoading ? 'not-allowed' : 'pointer' }}
        >
          {seedLoading ? t.seeding : t.seed1}
        </button>
        <button
          type="button"
          data-testid="btn-seed-two"
          onClick={() => void seedTestData('two_rounds')}
          disabled={seedLoading}
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: seedLoading ? 'not-allowed' : 'pointer' }}
        >
          {seedLoading ? t.seeding : t.seed2}
        </button>
        <button
          onClick={() => void prepareDemo()}
          disabled={seedLoading}
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: seedLoading ? 'not-allowed' : 'pointer' }}
        >
          {seedLoading ? t.preparing : t.prepareDemo}
        </button>
      </div>
      <div style={{ marginBottom: 12 }}>
        {seedError ? <span style={{ color: '#b00020' }}>{seedError}</span> : null}
        {!seedError && seedInfo ? <span style={{ color: '#666' }}>{seedInfo}</span> : null}
      </div>

      {dataLang && dataLang !== lang ? (
        <div style={{ border: '1px solid #f1c40f', background: '#fff8db', borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#7a5d00', marginBottom: 8 }}>{t.langDataMismatch}</div>
          <button
            onClick={() => void prepareDemo()}
            disabled={seedLoading}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d9b200', cursor: seedLoading ? 'not-allowed' : 'pointer' }}
          >
            {seedLoading ? t.preparing : t.rebuildData}
          </button>
        </div>
      ) : null}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, marginBottom: 12, background: '#fafafa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>{t.demoStatus}</b>
          <button
            onClick={() => void loadDemoStatus()}
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
              </>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>{t.noStatus}</div>
        )}
      </div>

      {view === 'search' ? (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#666' }}>{t.level}:</span>
            {(['ALL', 'HIGH', 'MEDIUM'] as const).map((lv) => (
              <button
                key={lv}
                onClick={() => setSearchLevelFilter(lv)}
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
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.placeholder}
              style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
            />
            <button
              onClick={() => void search()}
              style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}
            >
              {loading ? t.searching : t.search}
            </button>
          </div>

          {error ? (
            <div style={{ color: '#b00020', marginBottom: 12 }}>
              <b>Error:</b> {error}
            </div>
          ) : null}

          <div style={{ color: '#666', marginBottom: 10 }}>
            {(() => {
              const visibleCount =
                searchLevelFilter === 'ALL'
                  ? results.length
                  : results.filter((r) => (r.level ?? 'MEDIUM') === searchLevelFilter).length;
              return visibleCount ? `${t.hit} ${visibleCount}` : q.trim() ? t.noResult : t.inputTip;
            })()}
          </div>

          <div>
            {results
              .filter((r) => searchLevelFilter === 'ALL' || (r.level ?? 'MEDIUM') === searchLevelFilter)
              .map((r) => (
              <div
                key={r.cluster_id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 10,
                  background: '#fff',
                }}
              >
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
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  cluster_kind: {r.cluster_kind ?? 'topic_drift'}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => void loadClusterDetail(r.cluster_id)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}
                  >
                    {t.detail}
                  </button>
                </div>
                {Array.isArray(r.tags) && r.tags.length ? (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                    tags: {r.tags.join(', ')}
                  </div>
                ) : null}
                {personalizationReasonsAndFeedbackRow(r.cluster_id, r.personalization_reasons)}
              </div>
            ))}
          </div>

          {selectedClusterId ? (
            <div style={{ marginTop: 14, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: '#fbfbfb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>{t.clusterDetail}</h3>
                <button
                  onClick={() => {
                    setSelectedClusterId(null);
                    setClusterDetail(null);
                    setClusterDetailError(null);
                  }}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}
                >
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
                  <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                    tags: {(clusterDetail.tags ?? []).join(', ')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <h4 style={{ margin: 0 }}>{t.timelineEvidence}</h4>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['all', 'supports', 'contradicts', 'context'] as const).map((role) => (
                        <button
                          key={role}
                          onClick={() => setTimelineRoleFilter(role)}
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
                      .filter((t) => timelineRoleFilter === 'all' || t.role === timelineRoleFilter)
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

                    return filtered.map((t) => (
                      <div key={t.id} style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          role={t.role} · confidence={Number(t.link_confidence).toFixed(2)}
                          {t.published_at ? ` · published_at=${formatPublishedAt(t.published_at)}` : ''}
                        </div>
                        <div style={{ marginTop: 4 }}>{t.snippet_text}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                          <button
                            onClick={() => void copyText(t.snippet_text)}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12 }}
                          >
                            {t.copy}
                          </button>
                          {t.url ? (
                            <a href={t.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', fontSize: 12 }}>
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
      ) : view === 'homepage' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => void loadHomepage()}
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
                onClick={() => setHomepageLevelFilter(lv)}
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

          {(() => {
            const filteredDecisionCards = homepage.decision_cards.filter(
              (c) => homepageLevelFilter === 'ALL' || levelFromClusterKind(c.cluster_kind) === homepageLevelFilter,
            );
            const filteredTimeline = homepage.timeline_feed.filter(
              (c) => homepageLevelFilter === 'ALL' || levelFromClusterKind(c.cluster_kind) === homepageLevelFilter,
            );
            return (
              <>
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

          <h3 style={{ margin: '12px 0 8px' }}>{t.topicBoard} ({homepage.topic_board.length})</h3>
          <div style={{ marginBottom: 12, color: '#333', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {homepage.topic_board.length === 0 ? (
              <span>{t.topicNone}</span>
            ) : (
              homepage.topic_board.map((t) => (
                <span
                  key={t.topic}
                  style={{ border: '1px solid #e5e7eb', borderRadius: 999, padding: '4px 10px', fontSize: 12, background: '#fafafa' }}
                >
                  {t.topic} ({t.count})
                </span>
              ))
            )}
          </div>

          <h3 style={{ margin: '12px 0 8px' }}>{t.timeline} ({filteredTimeline.length})</h3>
          {filteredTimeline.map((i) => (
            <div
              key={`tl_${i.id}`}
              data-testid="timeline-row"
              style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}
            >
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
          })()}
        </>
      ) : view === 'sources' ? (
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
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginTop: 4 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#666' }}>{t.feedType}</div>
                <select
                  value={newFeedType}
                  onChange={(e) => setNewFeedType(e.target.value === 'tech' ? 'tech' : 'social')}
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
                  onChange={(e) => setNewFeedName(e.target.value)}
                  style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginTop: 4 }}
                />
              </div>
              <button
                type="button"
                data-testid="btn-add-feed"
                disabled={feedsLoading}
                onClick={() => void addFeedRow()}
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
                onClick={() => void collectFromStoredFeeds()}
                style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #1d4ed8', background: '#eff6ff', cursor: 'pointer' }}
              >
                {collectLoading ? t.collectStoredRunning : t.collectStored}
              </button>
              <button
                type="button"
                onClick={() => void loadFeeds()}
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
                onChange={(e) => setBookmarkJson(e.target.value)}
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
                onClick={() => void importBookmarksFromJson()}
                style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #6366f1', background: '#eef2ff', cursor: 'pointer' }}
              >
                {bookmarkLoading ? t.bookmarkImporting : t.bookmarkImport}
              </button>
              {bookmarkError ? <div style={{ color: '#b00020', marginTop: 8 }}>{bookmarkError}</div> : null}
              {bookmarkInfo ? <div style={{ color: '#166534', marginTop: 8 }}>{bookmarkInfo}</div> : null}
            </div>

            {feedsLoading ? <div style={{ color: '#666' }}>{t.loading}</div> : null}
            {!feeds.length && !feedsLoading ? <div style={{ color: '#666' }}>{t.noFeeds}</div> : null}
            {feeds.map((f) => (
              <div
                key={f.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {f.source_type} · id={f.id}
                  </div>
                  <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>{f.feed_url}</div>
                  {f.source_name ? <div style={{ fontSize: 12, color: '#64748b' }}>{f.source_name}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => void deleteFeedRow(f.id)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', flexShrink: 0 }}
                >
                  {t.removeFeed}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : view === 'personalize' ? (
        <>
          <div style={{ border: '1px solid #fce7f3', borderRadius: 10, padding: 12, marginBottom: 12, background: '#fffafb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0 }}>{t.persTitle}</h3>
              <button
                type="button"
                data-testid="btn-pers-reload"
                disabled={persLoading}
                onClick={() => void loadPersonalizationForm()}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', cursor: persLoading ? 'not-allowed' : 'pointer' }}
              >
                {t.persReload}
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{t.persHint}</div>
            {persError ? <div style={{ color: '#b00020', marginTop: 8 }}>{persError}</div> : null}
            {persOk ? <div style={{ color: '#166534', marginTop: 8 }}>{persOk}</div> : null}

            <label style={{ display: 'block', marginTop: 14, fontSize: 12, fontWeight: 600, color: '#334155' }}>{t.persAllowLabel}</label>
            <textarea
              data-testid="textarea-pers-allow"
              value={persAllowText}
              onChange={(e) => setPersAllowText(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 6,
                padding: 10,
                border: '1px solid #ddd',
                borderRadius: 6,
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            />

            <label style={{ display: 'block', marginTop: 14, fontSize: 12, fontWeight: 600, color: '#334155' }}>{t.persDenyLabel}</label>
            <textarea
              data-testid="textarea-pers-deny"
              value={persDenyText}
              onChange={(e) => setPersDenyText(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 6,
                padding: 10,
                border: '1px solid #ddd',
                borderRadius: 6,
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            />

            <label style={{ display: 'block', marginTop: 14, fontSize: 12, fontWeight: 600, color: '#334155' }}>{t.persPersonasLabel}</label>
            <textarea
              data-testid="textarea-pers-personas"
              value={persPersonasJson}
              onChange={(e) => setPersPersonasJson(e.target.value)}
              rows={10}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 6,
                padding: 10,
                border: '1px solid #ddd',
                borderRadius: 6,
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
              }}
            />

            <button
              type="button"
              data-testid="btn-pers-save"
              disabled={persLoading}
              onClick={() => void savePersonalizationForm()}
              style={{
                marginTop: 12,
                padding: '10px 16px',
                borderRadius: 6,
                border: '1px solid #db2777',
                background: '#fce7f3',
                cursor: persLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {persLoading ? t.persSaving : t.persSave}
            </button>
          </div>
        </>
      ) : (
        <>
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
              onChange={(e) => setPushApiToken(e.target.value)}
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
                onClick={() => void loadPushInfo()}
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
                onClick={() => void subscribeToPush()}
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
                onClick={() => void unsubscribeFromPush()}
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
        </>
      )}
    </div>
  );
}

