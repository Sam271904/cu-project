import { describe, expect, it } from 'vitest';
import { loadAppConfig } from '../src/config';

describe('loadAppConfig', () => {
  it('parses signal extractor modes', () => {
    expect(loadAppConfig({ ...process.env, PIH_SIGNAL_EXTRACTOR: 'mock' }).signalExtractor).toBe('mock');
    expect(loadAppConfig({ ...process.env, PIH_SIGNAL_EXTRACTOR: 'mock_llm' }).signalExtractor).toBe('mock');
    expect(loadAppConfig({ ...process.env, PIH_SIGNAL_EXTRACTOR: '' }).signalExtractor).toBe('placeholder');
  });

  it('parses PIH_CHANGE_POLICY override when valid', () => {
    expect(loadAppConfig({ PIH_CHANGE_POLICY: 'SOURCE_TRUSTED' }).changePolicyOverride).toBe('SOURCE_TRUSTED');
    expect(loadAppConfig({ PIH_CHANGE_POLICY: 'bad' }).changePolicyOverride).toBeNull();
    expect(loadAppConfig({}).changePolicyOverride).toBeNull();
  });
});
