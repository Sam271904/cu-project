/** Task 6.2 — pluggable extractor selection via env */
export function isMockSignalExtractor(env: NodeJS.ProcessEnv = process.env): boolean {
  const m = String(env.PIH_SIGNAL_EXTRACTOR ?? '').toLowerCase();
  return m === 'mock' || m === 'mock_llm';
}
