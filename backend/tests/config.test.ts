import { describe, expect, it } from 'vitest';
import { loadAppConfig } from '../src/config';

describe('loadAppConfig', () => {
  it('parses signal extractor modes', () => {
    expect(loadAppConfig({ ...process.env, PIH_SIGNAL_EXTRACTOR: 'mock' }).signalExtractor).toBe('mock');
    expect(loadAppConfig({ ...process.env, PIH_SIGNAL_EXTRACTOR: 'mock_llm' }).signalExtractor).toBe('mock');
    expect(loadAppConfig({ ...process.env, PIH_SIGNAL_EXTRACTOR: 'openai' }).signalExtractor).toBe('openai_compatible');
    expect(loadAppConfig({ ...process.env, PIH_SIGNAL_EXTRACTOR: 'openai_compatible' }).signalExtractor).toBe(
      'openai_compatible',
    );
    expect(loadAppConfig({ ...process.env, PIH_SIGNAL_EXTRACTOR: '' }).signalExtractor).toBe('placeholder');
  });

  it('parses LLM env for openai_compatible', () => {
    const c = loadAppConfig({
      PIH_SIGNAL_EXTRACTOR: 'openai_compatible',
      PIH_LLM_API_KEY: 'k',
      PIH_LLM_BASE_URL: 'https://api.example.com/v1/',
      PIH_LLM_MODEL: 'gpt-test',
      PIH_LLM_JSON_OBJECT: '0',
    });
    expect(c.llmApiKey).toBe('k');
    expect(c.llmBaseUrl).toBe('https://api.example.com/v1');
    expect(c.llmModel).toBe('gpt-test');
    expect(c.llmJsonObjectResponseFormat).toBe(false);
  });

  it('parses PIH_CHANGE_POLICY override when valid', () => {
    expect(loadAppConfig({ PIH_CHANGE_POLICY: 'SOURCE_TRUSTED' }).changePolicyOverride).toBe('SOURCE_TRUSTED');
    expect(loadAppConfig({ PIH_CHANGE_POLICY: 'bad' }).changePolicyOverride).toBeNull();
    expect(loadAppConfig({}).changePolicyOverride).toBeNull();
  });

  it('parses PIH_PUSH_API_TOKEN (Task 2.2)', () => {
    expect(loadAppConfig({ PIH_PUSH_API_TOKEN: '  secret  ' }).pushApiToken).toBe('secret');
    expect(loadAppConfig({ PIH_PUSH_API_TOKEN: '' }).pushApiToken).toBeNull();
    expect(loadAppConfig({}).pushApiToken).toBeNull();
  });

  it('parses PIH_PUSH_SUBSCRIPTION_SECRET (Task 8.1)', () => {
    expect(loadAppConfig({ PIH_PUSH_SUBSCRIPTION_SECRET: '  sec  ' }).pushSubscriptionSecret).toBe('sec');
    expect(loadAppConfig({ PIH_PUSH_SUBSCRIPTION_SECRET: '' }).pushSubscriptionSecret).toBeNull();
    expect(loadAppConfig({}).pushSubscriptionSecret).toBeNull();
  });
});
