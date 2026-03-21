"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMockSignalExtractor = isMockSignalExtractor;
/** Task 6.2 — pluggable extractor selection via env */
function isMockSignalExtractor(env = process.env) {
    const m = String(env.PIH_SIGNAL_EXTRACTOR ?? '').toLowerCase();
    return m === 'mock' || m === 'mock_llm';
}
