import type { ChangePolicy } from '@e-cu/shared';

import { parseChangePolicyEnvOverride } from './services/signal_extraction/changePolicyResolver';
import { DEFAULT_REMINDER_WEIGHTS, type ReminderWeights } from './services/notifications/reminderScoring';

/**
 * Documented environment variables (Task 0.2 / 2.2). No hard failure on missing optional keys.
 */
export type SignalExtractorMode = 'placeholder' | 'mock' | 'openai_compatible';

export type AppConfig = {
  port: number;
  databaseUrl: string | undefined;
  /** `placeholder` | `mock` — mock prefixes change_summary; `openai_compatible` — optional LLM summaries (see PIH_LLM_*) */
  signalExtractor: SignalExtractorMode;
  /**
   * Task 6.2: global override for `DecisionSignals.change_policy_used` when `PIH_CHANGE_POLICY` is a valid enum.
   * Otherwise resolved per cluster from evidence `source_type` in `extractSignalsForRound`.
   */
  changePolicyOverride: ChangePolicy | null;
  /**
   * Task 2.2: when non-empty, `POST /api/push/subscribe|unsubscribe|enqueue-test|send` require
   * `Authorization: Bearer <token>` or `X-PIH-Token: <token>`.
   */
  pushApiToken: string | null;
  /** Task 8.1: optional at-rest encryption secret for notification_subscriptions.subscription_json */
  pushSubscriptionSecret: string | null;
  /** OpenAI-compatible `POST /v1/chat/completions` — `PIH_LLM_API_KEY` or `OPENAI_API_KEY` */
  llmApiKey: string | null;
  /** Default `https://api.openai.com/v1` */
  llmBaseUrl: string;
  llmModel: string;
  /** When false, omit `response_format` (some gateways reject it) */
  llmJsonObjectResponseFormat: boolean;
  /**
   * Design: `significant_change_score = w1*evidence_novelty + w2*conclusion_delta + w3*conflict_delta` (sum normalized to 1).
   * Env: `PIH_REMINDER_W1`, `PIH_REMINDER_W2`, `PIH_REMINDER_W3` (optional; unset = defaults 0.4/0.4/0.2).
   */
  reminderWeights: ReminderWeights;
  /** Default 0.8 — score ≥ this ⇒ reminder_level `high` */
  reminderHighThreshold: number;
  /** Default 0.5 — `medium` band is [medium, high) */
  reminderMediumThreshold: number;
  /**
   * When true and `llmApiKey` set: fetch claim_text embedding (`POST .../embeddings`) for conclusion_delta cosine path.
   * `PIH_CLAIM_EMBEDDING=1`
   */
  claimEmbeddingEnabled: boolean;
  /** Default `text-embedding-3-small` */
  embeddingModel: string;
};

function parsePort(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseSignalExtractorMode(raw: string | undefined): SignalExtractorMode {
  const se = String(raw ?? 'placeholder').toLowerCase();
  if (se === 'mock' || se === 'mock_llm') return 'mock';
  if (se === 'openai' || se === 'openai_compatible') return 'openai_compatible';
  return 'placeholder';
}

function parseLlmApiKey(env: NodeJS.ProcessEnv): string | null {
  const a = env.PIH_LLM_API_KEY ?? env.OPENAI_API_KEY;
  if (typeof a === 'string' && a.trim().length > 0) return a.trim();
  return null;
}

/** Parse w1/w2/w3; if any set, normalize to sum=1. */
export function parseReminderWeightsFromEnv(env: NodeJS.ProcessEnv): ReminderWeights {
  const raw = [env.PIH_REMINDER_W1, env.PIH_REMINDER_W2, env.PIH_REMINDER_W3];
  const hasAny = raw.some((x) => x !== undefined && String(x).trim() !== '');
  if (!hasAny) {
    return { ...DEFAULT_REMINDER_WEIGHTS };
  }
  const parse = (s: string | undefined, fallback: number): number => {
    if (s === undefined || String(s).trim() === '') return fallback;
    const v = Number(s);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  let w1 = parse(env.PIH_REMINDER_W1, DEFAULT_REMINDER_WEIGHTS.w1);
  let w2 = parse(env.PIH_REMINDER_W2, DEFAULT_REMINDER_WEIGHTS.w2);
  let w3 = parse(env.PIH_REMINDER_W3, DEFAULT_REMINDER_WEIGHTS.w3);
  const sum = w1 + w2 + w3;
  if (sum <= 0) return { ...DEFAULT_REMINDER_WEIGHTS };
  return { w1: w1 / sum, w2: w2 / sum, w3: w3 / sum };
}

/** Defaults high=0.8, medium=0.5; invalid combos fall back. */
export function parseReminderThresholdsFromEnv(env: NodeJS.ProcessEnv): { highMin: number; mediumMin: number } {
  const high = Number(env.PIH_REMINDER_HIGH_THRESHOLD);
  const med = Number(env.PIH_REMINDER_MEDIUM_THRESHOLD);
  const highMin = Number.isFinite(high) && high > 0 && high <= 1 ? high : 0.8;
  const mediumMin = Number.isFinite(med) && med > 0 && med < 1 ? med : 0.5;
  if (mediumMin >= highMin) {
    return { highMin: 0.8, mediumMin: 0.5 };
  }
  return { highMin, mediumMin };
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const signalExtractor = parseSignalExtractorMode(env.PIH_SIGNAL_EXTRACTOR);

  const rawPush = env.PIH_PUSH_API_TOKEN;
  const pushApiToken =
    typeof rawPush === 'string' && rawPush.trim().length > 0 ? rawPush.trim() : null;
  const rawSubSecret = env.PIH_PUSH_SUBSCRIPTION_SECRET;
  const pushSubscriptionSecret =
    typeof rawSubSecret === 'string' && rawSubSecret.trim().length > 0 ? rawSubSecret.trim() : null;

  const llmBaseRaw = env.PIH_LLM_BASE_URL;
  const llmBaseUrl =
    typeof llmBaseRaw === 'string' && llmBaseRaw.trim().length > 0
      ? llmBaseRaw.trim().replace(/\/$/, '')
      : 'https://api.openai.com/v1';

  const llmModelRaw = env.PIH_LLM_MODEL;
  const llmModel =
    typeof llmModelRaw === 'string' && llmModelRaw.trim().length > 0 ? llmModelRaw.trim() : 'gpt-4o-mini';

  const jsonFmt = String(env.PIH_LLM_JSON_OBJECT ?? '1').toLowerCase();
  const llmJsonObjectResponseFormat = jsonFmt !== '0' && jsonFmt !== 'false' && jsonFmt !== 'no';

  const th = parseReminderThresholdsFromEnv(env);

  const ce = String(env.PIH_CLAIM_EMBEDDING ?? '').toLowerCase();
  const claimEmbeddingEnabled = ce === '1' || ce === 'true' || ce === 'yes';

  const embeddingModelRaw = env.PIH_EMBEDDING_MODEL;
  const embeddingModel =
    typeof embeddingModelRaw === 'string' && embeddingModelRaw.trim().length > 0
      ? embeddingModelRaw.trim()
      : 'text-embedding-3-small';

  return {
    port: parsePort(env.PORT, 3001),
    databaseUrl: env.DATABASE_URL,
    signalExtractor,
    changePolicyOverride: parseChangePolicyEnvOverride(env.PIH_CHANGE_POLICY),
    pushApiToken,
    pushSubscriptionSecret,
    llmApiKey: parseLlmApiKey(env),
    llmBaseUrl,
    llmModel,
    llmJsonObjectResponseFormat,
    reminderWeights: parseReminderWeightsFromEnv(env),
    reminderHighThreshold: th.highMin,
    reminderMediumThreshold: th.mediumMin,
    claimEmbeddingEnabled,
    embeddingModel,
  };
}
