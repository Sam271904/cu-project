import React from 'react';

import { DemoStatusPanel, type DemoStatusPanelData } from './components/DemoStatusPanel';
import { HomepagePage } from './pages/HomepagePage';
import { PersonalizePage } from './pages/PersonalizePage';
import { PushPage } from './pages/PushPage';
import { SearchPage } from './pages/SearchPage';
import { SourcesPage } from './pages/SourcesPage';
import { usePush } from './hooks/usePush';
import { useSources } from './hooks/useSources';
import type {
  AppView,
  ClusterDetailResponse,
  FeedType,
  HomepageResponse,
  LevelFilter,
  SearchResult,
  TimelineRoleFilter,
  UiLang,
} from './types/ui';
import { loadStoredDataLang, loadStoredLang, loadStoredLevel, loadStoredSearchQuery, loadStoredView } from './utils/localState';

// ─── Shared local helpers (used by page components) ───────────────────────────

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

function formatPublishedAt(input: string): string {
  if (!input) return '';
  const t = Date.parse(input);
  if (Number.isNaN(t)) return input;
  return new Date(t).toLocaleString();
}

function levelFromClusterKind(clusterKind?: string): 'HIGH' | 'MEDIUM' {
  return clusterKind === 'event_update' ? 'HIGH' : 'MEDIUM';
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function App() {
  // ── Core UI state ──────────────────────────────────────────────────────────
  const [view, setView] = React.useState<AppView>(loadStoredView);
  const [lang, setLang] = React.useState<UiLang>(loadStoredLang);
  const [dataLang, setDataLang] = React.useState<UiLang | null>(loadStoredDataLang);

  // ── Seed / Demo ─────────────────────────────────────────────────────────────
  const [seedLoading, setSeedLoading] = React.useState(false);
  const [seedError, setSeedError] = React.useState<string | null>(null);
  const [seedInfo, setSeedInfo] = React.useState<string | null>(null);

  // ── Homepage ───────────────────────────────────────────────────────────────
  const [homepageLoading, setHomepageLoading] = React.useState(false);
  const [homepageError, setHomepageError] = React.useState<string | null>(null);
  const [homepageLevelFilter, setHomepageLevelFilter] = React.useState<LevelFilter>(() =>
    loadStoredLevel('pih.homepage.levelFilter', 'ALL'),
  );
  const [homepage, setHomepage] = React.useState<HomepageResponse>({
    decision_cards: [],
    topic_board: [],
    timeline_feed: [],
  });

  // ── Demo Status ────────────────────────────────────────────────────────────
  const [demoStatusLoading, setDemoStatusLoading] = React.useState(false);
  const [demoStatusError, setDemoStatusError] = React.useState<string | null>(null);
  const [demoStatus, setDemoStatus] = React.useState<DemoStatusPanelData | null>(null);

  // ── Search ─────────────────────────────────────────────────────────────────
  const [q, setQ] = React.useState(() => loadStoredSearchQuery());
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searchLevelFilter, setSearchLevelFilter] = React.useState<LevelFilter>(() =>
    loadStoredLevel('pih.search.levelFilter', 'ALL'),
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ── Cluster Detail ─────────────────────────────────────────────────────────
  const [selectedClusterId, setSelectedClusterId] = React.useState<string | null>(null);
  const [clusterDetailLoading, setClusterDetailLoading] = React.useState(false);
  const [clusterDetailError, setClusterDetailError] = React.useState<string | null>(null);
  const [clusterDetail, setClusterDetail] = React.useState<ClusterDetailResponse | null>(null);
  const [timelineRoleFilter, setTimelineRoleFilter] = React.useState<TimelineRoleFilter>('all');

  // ── Personalization ────────────────────────────────────────────────────────
  const [persAllowText, setPersAllowText] = React.useState('');
  const [persDenyText, setPersDenyText] = React.useState('');
  const [persPersonasJson, setPersPersonasJson] = React.useState('[]');
  const [persLoading, setPersLoading] = React.useState(false);
  const [persError, setPersError] = React.useState<string | null>(null);
  const [persOk, setPersOk] = React.useState<string | null>(null);

  // ── Feedback ────────────────────────────────────────────────────────────────
  const [feedbackByCluster, setFeedbackByCluster] = React.useState<
    Record<string, { sentiment: number; saved: boolean }>
  >({});

  // ── Shared action callbacks (passed to pages) ───────────────────────────────
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
      const json = (await res.json()) as DemoStatusPanelData;
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
  ): React.ReactNode {
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
            {lang === 'zh' ? '赞' : 'Like'}
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
            {lang === 'zh' ? '踩' : 'Dislike'}
          </button>
          <button
            type="button"
            onClick={() => void postClusterFeedback(clusterId, { sentiment: 0 })}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12 }}
          >
            {lang === 'zh' ? '清除态度' : 'Clear'}
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
            {feedbackByCluster[clusterId]?.saved
              ? lang === 'zh' ? '取消收藏' : 'Unsave'
              : lang === 'zh' ? '收藏' : 'Save'}
          </button>
        </div>
      </>
    );
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

  // ── Search ───────────────────────────────────────────────────────────────────
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

  // ── Seed / Demo ──────────────────────────────────────────────────────────────
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
        `${lang === 'zh' ? '场景' : 'scenario'}=${json?.scenario ?? scenario}, ${lang === 'zh' ? '轮次' : 'round'}=${json?.round_id}, ${lang === 'zh' ? '类型统计' : 'kinds'}=${JSON.stringify(summary)}`,
      );
      if (!q.trim()) {
        setQ('Seed');
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
        `${lang === 'zh' ? '演示已准备' : 'demo prepared'}: ${lang === 'zh' ? '轮次' : 'round'}=${json?.round_id}, ${lang === 'zh' ? '类型统计' : 'kinds'}=${JSON.stringify(json?.cluster_kind_summary ?? {})}`,
      );
      setDataLang(lang);
      setQ('Seed');
      await Promise.all([loadHomepage(), loadDemoStatus()]);
      const res2 = await fetch(`/api/knowledge/search?q=${encodeURIComponent('Seed')}`);
      const j2 = (await res2.json()) as { results?: SearchResult[] };
      setResults(Array.isArray(j2.results) ? j2.results : []);
    } catch (e: any) {
      setSeedError(String(e?.message ?? e));
    } finally {
      setSeedLoading(false);
    }
  }

  // ── Personalization form ─────────────────────────────────────────────────────
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
      setPersPersonasJson(
        JSON.stringify(
          (j.personas ?? []).map((p) => ({ name: p.name, keywords: p.keywords, weight: p.weight })),
          null,
          2,
        ),
      );
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
      const allowLines = persAllowText.split('\n').map((x) => x.trim()).filter(Boolean);
      const denyLines = persDenyText.split('\n').map((x) => x.trim()).filter(Boolean);
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
        setPersError(lang === 'zh' ? 'Persona JSON 无效' : 'Invalid persona JSON');
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
      setPersOk(lang === 'zh' ? '已保存' : 'Saved');
      await Promise.all([loadHomepage(), loadFeedbackSummary()]);
      if (q.trim()) await search();
    } catch (e: any) {
      setPersError(String(e?.message ?? e));
    } finally {
      setPersLoading(false);
    }
  }

  // ── useSources ──────────────────────────────────────────────────────────────
  const sourcesHook = useSources({
    lang,
    onDataLanguageUpdated: (l: UiLang) => setDataLang(l),
    onAfterCollectOrImport: async () => {
      await Promise.all([loadHomepage(), loadDemoStatus()]);
    },
  });

  // ── usePush ──────────────────────────────────────────────────────────────────
  const pushHook = usePush({
    lang,
    msg: {
      pushNotSupported: lang === 'zh' ? '浏览器不支持 Web Push' : 'Web Push not supported',
      pushDisabled503: lang === 'zh' ? 'Push 服务已禁用' : 'Push service is disabled',
      pushUnauthorized: lang === 'zh' ? 'API Token 无效或已过期' : 'API Token invalid or expired',
      pushVapidMissing: lang === 'zh' ? 'VAPID 公钥未配置' : 'VAPID public key not configured',
      pushOkSubscribed: lang === 'zh' ? '订阅成功' : 'Subscribed successfully',
      pushOkUnsubscribed: lang === 'zh' ? '已取消订阅' : 'Unsubscribed successfully',
    },
  });

  // ── Effects ──────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    void loadHomepage();
    void loadDemoStatus();
    void loadFeedbackSummary();
  }, []);

  React.useEffect(() => {
    if (view === 'sources') void sourcesHook.loadFeeds();
  }, [view]);

  React.useEffect(() => {
    if (view === 'personalize') void loadPersonalizationForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  React.useEffect(() => {
    if (view === 'push') void pushHook.loadPushInfo();
  }, [view]);

  React.useEffect(() => {
    if (!q.trim()) return;
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── I18n text ────────────────────────────────────────────────────────────────
  const t = {
    title: lang === 'zh' ? '个人信息中台（MVP）' : 'Personal Information Hub (MVP)',
    searchTab: lang === 'zh' ? '知识搜索' : 'Knowledge Search',
    homepageTab: lang === 'zh' ? '首页' : 'Homepage',
    sourcesTab: lang === 'zh' ? '信源' : 'Sources',
    personalizeTab: lang === 'zh' ? '个性化' : 'Personalize',
    pushTab: lang === 'zh' ? '推送' : 'Push',
    langZh: lang === 'zh' ? '中文' : 'Chinese',
    langEn: 'English',
    clearState: lang === 'zh' ? '清空本地状态' : 'Clear Local State',
    seed1: lang === 'zh' ? 'Seed 测试数据（1轮）' : 'Seed test data (1 round)',
    seed2: lang === 'zh' ? 'Seed + 漂移验证（2轮）' : 'Seed + drift verify (2 rounds)',
    prepareDemo: lang === 'zh' ? '一键演示准备' : 'Prepare Demo',
    seeding: lang === 'zh' ? '生成中...' : 'Seeding...',
    preparing: lang === 'zh' ? '准备中...' : 'Preparing...',
    langDataMismatch:
      lang === 'zh'
        ? '检测到界面语言与当前数据语言不一致，建议重新生成数据以保持内容语言一致。'
        : 'UI language differs from current data language. Re-seed is recommended for consistent content language.',
    rebuildData: lang === 'zh' ? '按当前语言重建数据（2轮）' : 'Rebuild data in current language (2 rounds)',
    demoStatus: lang === 'zh' ? '演示状态' : 'Demo Status',
    refreshStatus: lang === 'zh' ? '刷新状态' : 'Refresh Status',
    noStatus: lang === 'zh' ? '暂无状态' : 'No status',
    loading: lang === 'zh' ? '加载中...' : 'Loading...',
  };

  // Homepage text (used by HomepagePage)
  const homepageText = {
    refreshHomepage: lang === 'zh' ? '刷新 Homepage' : 'Refresh Homepage',
    level: lang === 'zh' ? '等级' : 'Level',
    metricsTitle: lang === 'zh' ? '指标' : 'Metrics',
    metricsEmpty: lang === 'zh' ? '暂无指标数据' : 'No metrics yet',
    metricsHigh: lang === 'zh' ? '高优先级' : 'High',
    metricsMedium: lang === 'zh' ? '中优先级' : 'Medium',
    metricsRssFail: lang === 'zh' ? 'RSS失败' : 'RSS Fail',
    metricsQueued: lang === 'zh' ? '排队' : 'Queued',
    metricsSent: lang === 'zh' ? '已发送' : 'Sent',
    metricsFailed: lang === 'zh' ? '失败' : 'Failed',
    metricsSkipped: lang === 'zh' ? '跳过' : 'Skipped',
    metricsTrendTitle: lang === 'zh' ? '历史趋势' : 'Historical Trend',
    metricsTrendRound: lang === 'zh' ? '轮次' : 'Round',
    metricsTrendUpdatedAt: lang === 'zh' ? '更新时间' : 'Updated at',
    metricsNoiseRatio: lang === 'zh' ? '噪音比' : 'Noise Ratio',
    metricsIngestHealth: lang === 'zh' ? '摄入健康度' : 'Ingest Health',
    metricsAlertHighNoise: lang === 'zh' ? '⚠️ 噪音上升趋势' : '⚠️ Rising noise trend',
    metricsAlertLowIngestHealth: lang === 'zh' ? '⚠️ 摄入健康度低于80%' : '⚠️ Ingest health below 80%',
    metricsRecommendationTitle: lang === 'zh' ? '建议' : 'Recommendations',
    metricsRecommendationTune: lang === 'zh' ? '调参' : 'Tune',
    metricsRecommendationApply: lang === 'zh' ? '应用' : 'Apply',
    policyTuningTitle: lang === 'zh' ? '策略调优' : 'Policy Tuning',
    policySnapshotTitle: lang === 'zh' ? '快照' : 'Snapshot',
    policyChangeLogTitle: lang === 'zh' ? '变更日志' : 'Change Log',
    policyChangeLogEmpty: lang === 'zh' ? '暂无变更' : 'No changes yet',
    policyReviewWindowTitle: lang === 'zh' ? 'review window' : 'review window',
    policyReviewAfter: lang === 'zh' ? '之后' : 'after',
    policyReviewBefore: lang === 'zh' ? '之前' : 'before',
    decisionCards: lang === 'zh' ? '决策卡片' : 'Decision Cards',
    persScore: lang === 'zh' ? '分' : 'pts',
    viewSource: lang === 'zh' ? '查看来源' : 'View Source',
    topicBoard: lang === 'zh' ? '主题板' : 'Topic Board',
    topicNone: lang === 'zh' ? '暂无主题' : 'No topics',
    timeline: lang === 'zh' ? '时间线' : 'Timeline',
  };

  // Search text (used by SearchPage)
  const searchText = {
    level: lang === 'zh' ? '等级' : 'Level',
    search: lang === 'zh' ? '搜索' : 'Search',
    searching: lang === 'zh' ? '搜索中...' : 'Searching...',
    placeholder: lang === 'zh' ? '输入关键词，例如 Social / Tech' : 'Type keywords, e.g. Social / Tech',
    hit: lang === 'zh' ? '命中' : 'Hits',
    noResult: lang === 'zh' ? '暂无结果' : 'No results',
    inputTip: lang === 'zh' ? '请输入关键词开始搜索' : 'Type a keyword to search',
    detail: lang === 'zh' ? '查看详情' : 'View Detail',
    clusterDetail: lang === 'zh' ? '聚类详情' : 'Cluster Detail',
    close: lang === 'zh' ? '关闭' : 'Close',
    loading: lang === 'zh' ? '加载中...' : 'Loading...',
    timelineEvidence: lang === 'zh' ? '时间线 / 证据' : 'Timeline / Evidence',
    evidenceNone: lang === 'zh' ? '当前过滤条件下暂无 evidence links' : 'No evidence links under current filter',
    copy: lang === 'zh' ? '复制片段' : 'Copy Snippet',
    source: lang === 'zh' ? '跳转来源' : 'Open Source',
    persScore: lang === 'zh' ? '分' : 'pts',
  };

  // Personalize text (used by PersonalizePage)
  const persText = {
    persTitle: lang === 'zh' ? '个性化规则' : 'Personalization',
    persReload: lang === 'zh' ? '重新加载' : 'Reload',
    persHint:
      lang === 'zh'
        ? '保存后首页与搜索会按分数重排；屏蔽词命中的条目将不再出现。'
        : 'After save, homepage and search reorder by score; denied keywords hide items.',
    persAllowLabel: lang === 'zh' ? '偏好关键词（命中加分，每行一条）' : 'Boost keywords (one per line)',
    persDenyLabel: lang === 'zh' ? '屏蔽关键词（命中则隐藏条目）' : 'Hide keywords (one per line)',
    persPersonasLabel: lang === 'zh' ? '主题 Persona（JSON 数组）' : 'Topic personas (JSON array)',
    persSaving: lang === 'zh' ? '保存中…' : 'Saving…',
    persSave: lang === 'zh' ? '保存规则' : 'Save rules',
  };

  // Sources text (used by SourcesPage)
  const sourcesText = {
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
    loading: lang === 'zh' ? '加载中...' : 'Loading...',
    removeFeed: lang === 'zh' ? '删除' : 'Remove',
    feedHealthTitle: lang === 'zh' ? '信源健康度' : 'Feed Health',
    feedHealthNoData: lang === 'zh' ? '暂无健康数据' : 'No health data',
    mute1d: lang === 'zh' ? '静音1天' : 'Mute 1d',
    mute7d: lang === 'zh' ? '静音7天' : 'Mute 7d',
    mute30d: lang === 'zh' ? '静音30天' : 'Mute 30d',
    unmute: lang === 'zh' ? '解除静音' : 'Unmute',
    mutedUntil: lang === 'zh' ? '静音至' : 'Muted until',
  };

  // Push text (used by PushPage)
  const pushText = {
    pushTitle: lang === 'zh' ? 'Web Push 推送' : 'Web Push Notifications',
    pushHint:
      lang === 'zh'
        ? '订阅后可在浏览器收到个性化内容推送通知。需 Service Worker 支持。'
        : 'Subscribe to receive push notifications in your browser. Requires Service Worker.',
    pushTokenLabel: lang === 'zh' ? 'API Token（可选）' : 'API Token (optional)',
    pushTokenPlaceholder: lang === 'zh' ? 'sk-...' : 'sk-...',
    pushRefresh: lang === 'zh' ? '刷新状态' : 'Refresh',
    pushSubscribe: lang === 'zh' ? '订阅' : 'Subscribe',
    pushUnsubscribe: lang === 'zh' ? '取消订阅' : 'Unsubscribe',
    pushPermBrowser: lang === 'zh' ? '浏览器通知权限' : 'Browser Notification',
    pushPermServer: lang === 'zh' ? '服务端推送权限' : 'Server Push Permission',
    pushHasSub: lang === 'zh' ? '已有订阅' : 'Has subscription',
    pushSubCount: lang === 'zh' ? '订阅数' : 'Subscription count',
    pushVapidOk: lang === 'zh' ? 'VAPID 已配置' : 'VAPID configured',
    pushVapidNo: lang === 'zh' ? 'VAPID 未配置' : 'VAPID not configured',
    loading: lang === 'zh' ? '加载中...' : 'Loading...',
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial', padding: 16 }}>
      <h2 style={{ margin: '0 0 12px' }}>{t.title}</h2>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(
          [
            { key: 'search', label: t.searchTab, testId: 'tab-search' },
            { key: 'homepage', label: t.homepageTab, testId: 'tab-homepage' },
            { key: 'sources', label: t.sourcesTab, testId: 'tab-sources' },
            { key: 'personalize', label: t.personalizeTab, testId: 'tab-personalize' },
            { key: 'push', label: t.pushTab, testId: 'tab-push' },
          ] as const
        ).map(({ key, label, testId }) => (
          <button
            key={key}
            type="button"
            data-testid={testId}
            onClick={() => setView(key)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #ddd',
              cursor: 'pointer',
              background: view === key ? '#eef6ff' : '#fff',
            }}
          >
            {label}
          </button>
        ))}
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

      {/* Seed / Demo controls */}
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

      {/* Language mismatch banner */}
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

      {/* Demo Status panel */}
      <DemoStatusPanel
        lang={lang}
        t={{
          demoStatus: t.demoStatus,
          refreshStatus: t.refreshStatus,
          noStatus: t.noStatus,
          privacyPass: lang === 'zh' ? '通过' : 'PASS',
          privacyFail: lang === 'zh' ? '失败' : 'FAIL',
        }}
        demoStatus={demoStatus}
        demoStatusLoading={demoStatusLoading}
        demoStatusError={demoStatusError}
        onRefresh={() => void loadDemoStatus()}
      />

      {/* Page content */}
      {view === 'search' ? (
        <SearchPage
          t={searchText}
          q={q}
          loading={loading}
          error={error}
          results={results}
          searchLevelFilter={searchLevelFilter}
          selectedClusterId={selectedClusterId}
          clusterDetailLoading={clusterDetailLoading}
          clusterDetailError={clusterDetailError}
          clusterDetail={clusterDetail}
          timelineRoleFilter={timelineRoleFilter}
          onSearch={() => void search()}
          onChangeQuery={setQ}
          onChangeSearchLevelFilter={setSearchLevelFilter}
          onLoadClusterDetail={loadClusterDetail}
          onCloseClusterDetail={() => {
            setSelectedClusterId(null);
            setClusterDetail(null);
            setClusterDetailError(null);
          }}
          onChangeTimelineRoleFilter={setTimelineRoleFilter}
          formatPublishedAt={formatPublishedAt}
          copyText={copyText}
          personalizationReasonsAndFeedbackRow={personalizationReasonsAndFeedbackRow}
        />
      ) : view === 'homepage' ? (
        <HomepagePage
          lang={lang}
          t={homepageText}
          homepageLoading={homepageLoading}
          homepageError={homepageError}
          homepageLevelFilter={homepageLevelFilter}
          homepage={homepage}
          demoStatus={demoStatus}
          onRefresh={() => void loadHomepage()}
          onChangeLevelFilter={setHomepageLevelFilter}
          onApplySuggestedHighThreshold={(v: number) => {
            // TODO: wire to policy tuning endpoint when available
            console.info('apply suggested high threshold', v);
          }}
          levelFromClusterKind={levelFromClusterKind}
          personalizationReasonsAndFeedbackRow={personalizationReasonsAndFeedbackRow}
        />
      ) : view === 'sources' ? (
        <SourcesPage
          t={sourcesText}
          feeds={sourcesHook.feeds}
          feedsLoading={sourcesHook.feedsLoading}
          feedsError={sourcesHook.feedsError}
          feedHealth={sourcesHook.feedHealth}
          newFeedUrl={sourcesHook.newFeedUrl}
          newFeedType={sourcesHook.newFeedType}
          newFeedName={sourcesHook.newFeedName}
          collectLoading={sourcesHook.collectLoading}
          collectError={sourcesHook.collectError}
          collectInfo={sourcesHook.collectInfo}
          bookmarkJson={sourcesHook.bookmarkJson}
          bookmarkLoading={sourcesHook.bookmarkLoading}
          bookmarkError={sourcesHook.bookmarkError}
          bookmarkInfo={sourcesHook.bookmarkInfo}
          onSetNewFeedUrl={sourcesHook.setNewFeedUrl}
          onSetNewFeedType={sourcesHook.setNewFeedType as (v: FeedType) => void}
          onSetNewFeedName={sourcesHook.setNewFeedName}
          onAddFeedRow={() => void sourcesHook.addFeedRow()}
          onCollectFromStoredFeeds={() => void sourcesHook.collectFromStoredFeeds()}
          onLoadFeeds={() => void sourcesHook.loadFeeds()}
          onSetBookmarkJson={sourcesHook.setBookmarkJson}
          onImportBookmarksFromJson={() => void sourcesHook.importBookmarksFromJson()}
          onDeleteFeedRow={(id: number) => void sourcesHook.deleteFeedRow(id)}
          onPatchFeedMute={(id: number, muteDays: number) => void sourcesHook.patchFeedMute(id, muteDays)}
        />
      ) : view === 'personalize' ? (
        <PersonalizePage
          t={persText}
          persLoading={persLoading}
          persError={persError}
          persOk={persOk}
          persAllowText={persAllowText}
          persDenyText={persDenyText}
          persPersonasJson={persPersonasJson}
          onReload={() => void loadPersonalizationForm()}
          onSetPersAllowText={setPersAllowText}
          onSetPersDenyText={setPersDenyText}
          onSetPersPersonasJson={setPersPersonasJson}
          onSave={() => void savePersonalizationForm()}
        />
      ) : view === 'push' ? (
        <PushPage
          lang={lang}
          t={pushText}
          pushApiToken={pushHook.pushApiToken}
          pushInfoLoading={pushHook.pushInfoLoading}
          pushActionLoading={pushHook.pushActionLoading}
          pushError={pushHook.pushError}
          pushInfo={pushHook.pushInfo}
          browserNotifPermission={pushHook.browserNotifPermission}
          pushConsent={pushHook.pushConsent}
          pushStatus={pushHook.pushStatus}
          onSetPushApiToken={pushHook.setPushApiToken}
          onLoadPushInfo={() => void pushHook.loadPushInfo()}
          onSubscribeToPush={() => void pushHook.subscribeToPush()}
          onUnsubscribeFromPush={() => void pushHook.unsubscribeFromPush()}
        />
      ) : null}
    </div>
  );
}
