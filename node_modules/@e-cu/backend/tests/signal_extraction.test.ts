import { describe, expect, it } from 'vitest';
import { buildClaimTextFromDecisionSignals } from '../src/services/signal_extraction/buildClaimText';

describe('buildClaimTextFromDecisionSignals (Task 6.1)', () => {
  const minimal = {
    change: { change_summary: 'c1' },
    risk: { risk_summary: 'r1' },
    opportunity: { opportunity_summary: 'o1' },
    disagreement: {
      dispute_summary: 'd1',
      sides: ['A', 'B'],
      coverage_gaps: ['g1', 'g2'],
    },
  };

  it('matches v1 concatenation contract from spec', () => {
    expect(buildClaimTextFromDecisionSignals(minimal)).toBe(
      'CHANGE:c1||RISK:r1||OPP:o1||DISPUTE:d1||SIDES:A,B||GAPS:g1,g2',
    );
  });

  it('is deterministic for identical inputs', () => {
    const a = buildClaimTextFromDecisionSignals(minimal);
    const b = buildClaimTextFromDecisionSignals(minimal);
    expect(a).toBe(b);
  });

  it('coerces side/gap entries with String() and joins with comma', () => {
    const out = buildClaimTextFromDecisionSignals({
      change: { change_summary: '' },
      risk: { risk_summary: '' },
      opportunity: { opportunity_summary: '' },
      disagreement: {
        dispute_summary: '',
        sides: ['x'],
        coverage_gaps: [''],
      },
    });
    expect(out).toBe('CHANGE:||RISK:||OPP:||DISPUTE:||SIDES:x||GAPS:');
  });

  it('does not embed raw evidence snippets (contract: summaries only)', () => {
    const text = buildClaimTextFromDecisionSignals({
      change: { change_summary: 'summary only' },
      risk: { risk_summary: 'risk' },
      opportunity: { opportunity_summary: 'opp' },
      disagreement: { dispute_summary: 'disp', sides: [], coverage_gaps: [] },
    });
    expect(text).not.toMatch(/snippet/i);
    expect(text.startsWith('CHANGE:')).toBe(true);
  });
});
