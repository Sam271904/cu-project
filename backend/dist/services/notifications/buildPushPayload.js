"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncateWithEllipsis = truncateWithEllipsis;
exports.buildPushPayload = buildPushPayload;
exports.signalFingerprintFromSignalsJson = signalFingerprintFromSignalsJson;
const node_crypto_1 = __importDefault(require("node:crypto"));
function truncateWithEllipsis(input, maxChars) {
    if (input.length <= maxChars)
        return input;
    if (maxChars <= 3)
        return input.slice(0, maxChars);
    return input.slice(0, maxChars - 3) + '...';
}
function buildPushPayload(opts) {
    const short_summary = truncateWithEllipsis(String(opts.short_summary_source ?? ''), 120);
    // Strict keyset (spec requirement)
    return {
        event_key: opts.event_key,
        reminder_level: opts.reminder_level,
        title: opts.title,
        short_summary,
    };
}
function signalFingerprintFromSignalsJson(signals_json, signal_schema_version) {
    // Deterministic fingerprint; in v1 this replaces the full evidence_ref_ids derivation
    // (until we fully materialize evidence_ref_ids in extraction).
    const input = `${signal_schema_version}|${signals_json}`;
    return node_crypto_1.default.createHash('sha256').update(input).digest('hex');
}
