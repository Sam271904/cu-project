import { describe, expect, it } from 'vitest';
import {
  loadAppConfig,
  parseReminderThresholdsFromEnv,
  parseReminderWeightsFromEnv,
} from '../src/config';

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

  it('parses reminder weights (Task 8.2 NotificationPolicy)', () => {
    const w = parseReminderWeightsFromEnv({
      PIH_REMINDER_W1: '0.5',
      PIH_REMINDER_W2: '0.3',
      PIH_REMINDER_W3: '0.2',
    });
    expect(w.w1 + w.w2 + w.w3).toBeCloseTo(1, 5);
    expect(w.w1).toBeCloseTo(0.5, 5);
    expect(parseReminderWeightsFromEnv({}).w1).toBeCloseTo(0.4, 5);
  });

  it('parses reminder thresholds and rejects invalid order', () => {
    expect(
      parseReminderThresholdsFromEnv({ PIH_REMINDER_HIGH_THRESHOLD: '0.85', PIH_REMINDER_MEDIUM_THRESHOLD: '0.45' }),
    ).toEqual({
      highMin: 0.85,
      mediumMin: 0.45,
    });
    expect(parseReminderThresholdsFromEnv({ PIH_REMINDER_HIGH_THRESHOLD: '0.3', PIH_REMINDER_MEDIUM_THRESHOLD: '0.8' })).toEqual({
      highMin: 0.8,
      mediumMin: 0.5,
    });
  });

  it('parses claim embedding flags', () => {
    const c = loadAppConfig({
      PIH_CLAIM_EMBEDDING: '1',
      PIH_EMBEDDING_MODEL: 'text-embedding-ada-002',
      PIH_LLM_API_KEY: 'k',
    });
    expect(c.claimEmbeddingEnabled).toBe(true);
    expect(c.embeddingModel).toBe('text-embedding-ada-002');
  });

  it('loadAppConfig exposes reminder policy', () => {
    const c = loadAppConfig({
      PIH_REMINDER_W1: '2',
      PIH_REMINDER_W2: '2',
      PIH_REMINDER_W3: '1',
      PIH_REMINDER_HIGH_THRESHOLD: '0.75',
      PIH_REMINDER_MEDIUM_THRESHOLD: '0.4',
    });
    expect(c.reminderWeights.w1 + c.reminderWeights.w2 + c.reminderWeights.w3).toBeCloseTo(1, 5);
    expect(c.reminderHighThreshold).toBe(0.75);
    expect(c.reminderMediumThreshold).toBe(0.4);
  });
});
