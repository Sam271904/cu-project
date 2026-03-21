"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAppConfig = loadAppConfig;
const changePolicyResolver_1 = require("./services/signal_extraction/changePolicyResolver");
function parsePort(raw, fallback) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
function loadAppConfig(env = process.env) {
    const se = String(env.PIH_SIGNAL_EXTRACTOR ?? 'placeholder').toLowerCase();
    const signalExtractor = se === 'mock' || se === 'mock_llm' ? 'mock' : 'placeholder';
    return {
        port: parsePort(env.PORT, 3001),
        databaseUrl: env.DATABASE_URL,
        signalExtractor,
        changePolicyOverride: (0, changePolicyResolver_1.parseChangePolicyEnvOverride)(env.PIH_CHANGE_POLICY),
    };
}
