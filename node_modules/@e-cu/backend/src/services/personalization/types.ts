export type PersonalizationProfile = {
  /** lowercased keywords */
  allow: string[];
  deny: string[];
  personas: Array<{ name: string; keywords: string[]; weight: number }>;
  feedback: Record<string, { sentiment: number; saved: boolean; updated_at_utc?: string }>;
};

export type PersonalizationScore = {
  score: number;
  reasons: string[];
  denied: boolean;
  /** HN velocity + position signal [0, 1], null if no HN data */
  hn_signal?: number | null;
};
