import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { getCreateSchemaSql } from '../src/db/schema';
import { loadPersonalizationProfile } from '../src/services/personalization/loadProfile';
import { scoreClusterForPersonalization } from '../src/services/personalization/scoreCluster';
import type { PersonalizationProfile } from '../src/services/personalization/types';

const emptyProfile: PersonalizationProfile = { allow: [], deny: [], personas: [], feedback: {} };

describe('scoreClusterForPersonalization', () => {
  it('deny keyword excludes via denied flag', () => {
    const profile: PersonalizationProfile = {
      ...emptyProfile,
      deny: ['spam'],
    };
    const r = scoreClusterForPersonalization(
      {
        cluster_id: 'c1',
        content_summary: 'This is spam content',
        snippet_text: '',
        tags: [],
      },
      profile,
    );
    expect(r.denied).toBe(true);
    expect(r.score).toBeLessThan(0);
  });

  it('allow and persona add reasons', () => {
    const profile: PersonalizationProfile = {
      allow: ['ai'],
      deny: [],
      personas: [{ name: 'macro', keywords: ['cpi'], weight: 2 }],
      feedback: {},
    };
    const r = scoreClusterForPersonalization(
      {
        cluster_id: 'c1',
        content_summary: 'AI tools and CPI report',
        snippet_text: '',
        tags: [],
      },
      profile,
    );
    expect(r.denied).toBe(false);
    expect(r.reasons.some((x) => x.startsWith('allow:'))).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('persona:macro'))).toBe(true);
  });

  it('feedback like/saved adjusts score', () => {
    const profile: PersonalizationProfile = {
      ...emptyProfile,
      feedback: { c1: { sentiment: 1, saved: true } },
    };
    const r = scoreClusterForPersonalization(
      { cluster_id: 'c1', content_summary: 'x', snippet_text: '', tags: [] },
      profile,
    );
    expect(r.reasons.some((x) => x.startsWith('feedback:like'))).toBe(true);
    expect(r.reasons.some((x) => x.startsWith('feedback:saved'))).toBe(true);
  });
});

describe('loadPersonalizationProfile', () => {
  it('reads empty tables', () => {
    const db = new Database(':memory:');
    for (const sql of getCreateSchemaSql()) db.exec(sql);
    const p = loadPersonalizationProfile(db);
    expect(p.allow.length).toBe(0);
    expect(p.deny.length).toBe(0);
    db.close();
  });
});
