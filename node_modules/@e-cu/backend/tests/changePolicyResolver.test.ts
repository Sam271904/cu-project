import { afterEach, describe, expect, it } from 'vitest';
import {
  parseChangePolicyEnvOverride,
  resolveChangePolicyFromSourceTypes,
} from '../src/services/signal_extraction/changePolicyResolver';

describe('changePolicyResolver (Task 6.2 Step 4)', () => {
  const prev = process.env.PIH_CHANGE_POLICY;

  afterEach(() => {
    if (prev === undefined) delete process.env.PIH_CHANGE_POLICY;
    else process.env.PIH_CHANGE_POLICY = prev;
  });

  it('parseChangePolicyEnvOverride accepts valid enum and rejects junk', () => {
    expect(parseChangePolicyEnvOverride('SOURCE_TRUSTED')).toBe('SOURCE_TRUSTED');
    expect(parseChangePolicyEnvOverride('  EVIDENCE_WEIGHTED  ')).toBe('EVIDENCE_WEIGHTED');
    expect(parseChangePolicyEnvOverride('not_a_policy')).toBeNull();
    expect(parseChangePolicyEnvOverride('')).toBeNull();
    expect(parseChangePolicyEnvOverride(undefined)).toBeNull();
  });

  it('resolveChangePolicyFromSourceTypes: override wins', () => {
    expect(resolveChangePolicyFromSourceTypes(['social', 'tech'], 'USER_OVERRIDE')).toBe('USER_OVERRIDE');
  });

  it('resolveChangePolicyFromSourceTypes: bookmark → USER_OVERRIDE', () => {
    expect(resolveChangePolicyFromSourceTypes(['tech', 'bookmark'], null)).toBe('USER_OVERRIDE');
  });

  it('resolveChangePolicyFromSourceTypes: only tech → SOURCE_TRUSTED', () => {
    expect(resolveChangePolicyFromSourceTypes(['tech'], null)).toBe('SOURCE_TRUSTED');
  });

  it('resolveChangePolicyFromSourceTypes: social (no bookmark) → EVIDENCE_WEIGHTED', () => {
    expect(resolveChangePolicyFromSourceTypes(['social'], null)).toBe('EVIDENCE_WEIGHTED');
  });

  it('resolveChangePolicyFromSourceTypes: empty → LATEST_WINS', () => {
    expect(resolveChangePolicyFromSourceTypes([], null)).toBe('LATEST_WINS');
  });

  it('resolveChangePolicyFromSourceTypes: tech+social mix → EVIDENCE_WEIGHTED (social noise)', () => {
    expect(resolveChangePolicyFromSourceTypes(['social', 'tech'], null)).toBe('EVIDENCE_WEIGHTED');
  });
});
