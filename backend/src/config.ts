import type { ChangePolicy } from '@e-cu/shared';

import { parseChangePolicyEnvOverride } from './services/signal_extraction/changePolicyResolver';

/**
 * Documented environment variables (Task 0.2 / 2.2). No hard failure on missing optional keys.
 */
export type AppConfig = {
  port: number;
  databaseUrl: string | undefined;
  /** `placeholder` | `mock` — mock prefixes change_summary for integration tests */
  signalExtractor: 'placeholder' | 'mock';
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
};

function parsePort(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const se = String(env.PIH_SIGNAL_EXTRACTOR ?? 'placeholder').toLowerCase();
  const signalExtractor: 'placeholder' | 'mock' = se === 'mock' || se === 'mock_llm' ? 'mock' : 'placeholder';

  const rawPush = env.PIH_PUSH_API_TOKEN;
  const pushApiToken =
    typeof rawPush === 'string' && rawPush.trim().length > 0 ? rawPush.trim() : null;
  const rawSubSecret = env.PIH_PUSH_SUBSCRIPTION_SECRET;
  const pushSubscriptionSecret =
    typeof rawSubSecret === 'string' && rawSubSecret.trim().length > 0 ? rawSubSecret.trim() : null;

  return {
    port: parsePort(env.PORT, 3001),
    databaseUrl: env.DATABASE_URL,
    signalExtractor,
    changePolicyOverride: parseChangePolicyEnvOverride(env.PIH_CHANGE_POLICY),
    pushApiToken,
    pushSubscriptionSecret,
  };
}
