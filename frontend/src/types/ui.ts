export type UiLang = 'zh' | 'en';

export type AppView = 'search' | 'homepage' | 'sources' | 'personalize' | 'push';
export type LevelFilter = 'ALL' | 'HIGH' | 'MEDIUM';
export type TimelineRoleFilter = 'all' | 'supports' | 'contradicts' | 'context';
export type FeedType = 'social' | 'tech';

export type SearchResult = {
  cluster_id: string;
  content_summary: string;
  snippet_text: string;
  cluster_kind?: string;
  level?: 'HIGH' | 'MEDIUM';
  tags: string[];
  personalization_score?: number;
  personalization_reasons?: string[];
};

export type HomepageCard = {
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

export type TopicBoardItem = {
  topic: string;
  count: number;
};

export type HomepageResponse = {
  decision_cards: HomepageCard[];
  topic_board: TopicBoardItem[];
  timeline_feed: HomepageCard[];
};

export type ClusterTimelineItem = {
  id: string;
  role: string;
  link_confidence: number;
  url: string;
  published_at: string;
  snippet_text: string;
};

export type ClusterDetailResponse = {
  success: boolean;
  cluster_id: string;
  content_summary: string;
  snippet_text: string;
  tags: string[];
  timeline: ClusterTimelineItem[];
};

export type FeedRow = {
  id: number;
  source_type: string;
  feed_url: string;
  source_id: string | null;
  source_name: string | null;
  enabled: number;
  sort_order: number;
  muted_until_utc?: string | null;
};

export type FeedHealthRow = {
  id: number;
  feed_url: string;
  source_type: string;
  source_name: string | null;
  muted_until_utc: string | null;
  total_fetches: number;
  total_successes: number;
  total_failures: number;
  consecutive_failures: number;
  last_status: string;
  last_error: string | null;
  last_checked_at_utc: string | null;
  success_rate: number | null;
  recommendation: string;
  recommendation_message?: string;
  is_muted: boolean;
};

export type PushConsentPayload = {
  has_subscription: boolean;
  push_permission_status: string;
  consent_timestamp: string | null;
  last_subscription_at_utc: string | null;
};

export type PushStatusPayload = {
  subscription_count: number;
  vapid_configured: boolean;
};
