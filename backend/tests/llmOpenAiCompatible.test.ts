import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildUserPrompt,
  fetchLlmSummariesOpenAiCompatible,
  mergeLlmSummariesIntoDecisionSignals,
} from '../src/services/signal_extraction/llmOpenAiCompatible';
import type { DecisionSignalsPayload } from '../src/services/signal_extraction/decisionSignalsBuilder';

describe('llmOpenAiCompatible', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mergeLlmSummariesIntoDecisionSignals preserves evidence_links', () => {
    const base = {
      cluster_id: 'c1',
      signal_schema_version: 'v1',
      change_policy_used: 'LATEST_WINS' as const,
      change: {
        evidence_links: [],
        change_policy_used: 'LATEST_WINS' as const,
        change_summary: 'old',
        change_type: 'unknown' as const,
      },
      risk: {
        evidence_links: [],
        change_policy_used: 'LATEST_WINS' as const,
        risk_summary: 'r0',
      },
      opportunity: {
        evidence_links: [],
        change_policy_used: 'LATEST_WINS' as const,
        opportunity_summary: 'o0',
      },
      disagreement: {
        evidence_links: [],
        change_policy_used: 'LATEST_WINS' as const,
        dispute_summary: 'd0',
        sides: ['x'],
        coverage_gaps: ['g'],
      },
    } as DecisionSignalsPayload;

    const merged = mergeLlmSummariesIntoDecisionSignals(base, {
      change_summary: 'newc',
      change_type: 'supplemented',
      risk_summary: 'newr',
      opportunity_summary: 'newo',
      dispute_summary: 'newd',
      sides: ['A', 'B'],
      coverage_gaps: [],
    });
    expect(merged.change.change_summary).toBe('newc');
    expect(merged.change.change_type).toBe('supplemented');
    expect(merged.change.evidence_links).toEqual([]);
    expect(merged.disagreement.sides).toEqual(['A', 'B']);
  });

  it('fetchLlmSummariesOpenAiCompatible parses OpenAI-style response', async () => {
    const payload = {
      change_summary: 'C',
      change_type: 'added',
      risk_summary: 'R',
      opportunity_summary: 'O',
      dispute_summary: 'D',
      sides: ['a'],
      coverage_gaps: ['gap'],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(payload) } }],
          }),
      })) as unknown as typeof fetch,
    );
    const out = await fetchLlmSummariesOpenAiCompatible(
      {
        apiKey: 'k',
        baseUrl: 'https://example.com/v1',
        model: 'm',
        useJsonObjectResponseFormat: true,
      },
      'user',
    );
    expect(out.change_summary).toBe('C');
  });

  it('buildUserPrompt includes cluster label', () => {
    const p = buildUserPrompt({
      uiLang: 'en',
      clusterLabel: 'MyLabel',
      changePolicy: 'LATEST_WINS',
      evidenceBullets: ['one', 'two'],
    });
    expect(p).toContain('MyLabel');
    expect(p).toContain('one');
  });
});
