export type HnStoryType = 'top' | 'new' | 'best';

export type HnStory = {
  hn_id: number;
  title: string;
  url: string;
  hn_url: string;
  author: string;
  position: number; // 1 = top of the list
  score: number;
  comment_count: number;
  story_type: HnStoryType;
  fetched_at: string; // ISO UTC
  /** Null if never observed before */
  prev_position: number | null;
  /** Computed: prev_position - position (positive = rising) */
  velocity: number | null;
};

export type HnAdapterConfig = {
  enabled: boolean;
  fetchLimit: number; // per list, max 100
  storyTypes: HnStoryType[];
  fallbackToRss: boolean;
};
