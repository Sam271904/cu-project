import type { ChangePolicy } from '@e-cu/shared';

import { parseChangePolicyEnvOverride } from './services/signal_extraction/changePolicyResolver';

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
  };
}
