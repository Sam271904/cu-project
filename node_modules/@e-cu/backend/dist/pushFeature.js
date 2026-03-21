"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPushPipelineEnabled = isPushPipelineEnabled;
/**
 * Web Push is optional for this product release.
 * When disabled (default), `/api/collect` skips notification enqueue and push HTTP APIs return 503.
 * Set `PIH_PUSH_ENABLED=true` for integration tests / manual push debugging.
 */
function isPushPipelineEnabled() {
    return process.env.PIH_PUSH_ENABLED === 'true';
}
