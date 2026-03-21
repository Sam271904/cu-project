export type PersonalizationProfile = {
  /** lowercased keywords */
  allow: string[];
  deny: string[];
  personas: Array<{ name: string; keywords: string[]; weight: number }>;
  feedback: Record<string, { sentiment: number; saved: boolean }>;
};

export type PersonalizationScore = {
  score: number;
  reasons: string[];
  denied: boolean;
};
