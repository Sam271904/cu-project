/**
 * RSS HTTP fetch tuning (design: retry_policy + rate_limit_per_minute).
 * Env: PIH_RSS_MAX_ATTEMPTS, PIH_RSS_BACKOFF_BASE_MS, PIH_RSS_BACKOFF_MAX_MS, PIH_RSS_RATE_LIMIT_PER_MINUTE
 */
export type RssFetchConfig = {
  maxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  /** 0 = no per-host throttle */
  rateLimitPerMinute: number;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseNonNegInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function loadRssFetchConfig(env: NodeJS.ProcessEnv = process.env): RssFetchConfig {
  return {
    maxAttempts: Math.min(10, Math.max(1, parsePositiveInt(env.PIH_RSS_MAX_ATTEMPTS, 3))),
    backoffBaseMs: Math.min(60_000, Math.max(50, parsePositiveInt(env.PIH_RSS_BACKOFF_BASE_MS, 500))),
    backoffMaxMs: Math.min(120_000, Math.max(100, parsePositiveInt(env.PIH_RSS_BACKOFF_MAX_MS, 8000))),
    rateLimitPerMinute: Math.min(600, parseNonNegInt(env.PIH_RSS_RATE_LIMIT_PER_MINUTE, 30)),
  };
}
