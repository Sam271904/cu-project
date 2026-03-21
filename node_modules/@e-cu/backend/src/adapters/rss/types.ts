export type RawItem = {
  source_id: string;
  external_id: string;
  title: string;
  published_at?: string;
  collected_at: string;
  url: string;
  excerpt_or_summary?: string;
  author?: string;
  language: string;
  timestamp_quality: 'pubDate' | 'missing';
};

