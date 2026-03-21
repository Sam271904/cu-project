/**
 * Web Push is optional for this product release.
 * When disabled (default), `/api/collect` skips notification enqueue and push HTTP APIs return 503.
 * Set `PIH_PUSH_ENABLED=true` for integration tests / manual push debugging.
 */
export function isPushPipelineEnabled(): boolean {
  return process.env.PIH_PUSH_ENABLED === 'true';
}
