import { loadRssFetchConfig } from './adapters/rss/rssFetchConfig';
import { loadAppConfig } from './config';
import { isPushPipelineEnabled } from './pushFeature';

/** Fields shared by `GET /api/config` and `/api/demo/status` (no secrets). */
export function getPublicRuntimeConfigBody() {
  const appCfg = loadAppConfig();
  const rssCfg = loadRssFetchConfig();
  return {
    signal_extractor: appCfg.signalExtractor,
    push_pipeline_enabled: isPushPipelineEnabled(),
    notification_policy: {
      weights: appCfg.reminderWeights,
      high_threshold: appCfg.reminderHighThreshold,
      medium_threshold: appCfg.reminderMediumThreshold,
      claim_embedding_enabled: appCfg.claimEmbeddingEnabled && Boolean(appCfg.llmApiKey),
      embedding_model: appCfg.embeddingModel,
    },
    rss_fetch: {
      max_attempts: rssCfg.maxAttempts,
      backoff_base_ms: rssCfg.backoffBaseMs,
      backoff_max_ms: rssCfg.backoffMaxMs,
      rate_limit_per_minute: rssCfg.rateLimitPerMinute,
    },
    llm_configured: Boolean(appCfg.llmApiKey),
  };
}

/** `GET /api/config` JSON body */
export function getPublicRuntimeConfigResponse() {
  return { success: true as const, ...getPublicRuntimeConfigBody() };
}
