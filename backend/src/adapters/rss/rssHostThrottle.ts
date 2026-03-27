import { URL } from 'node:url';

const lastFetchAtMsByHost = new Map<string, number>();

/**
 * Ensures minimum spacing between RSS HTTP requests to the same host (global process scope).
 * When `rateLimitPerMinute` is 0, no waiting is applied.
 */
export async function throttleRssHost(feedUrl: string, rateLimitPerMinute: number): Promise<void> {
  if (!rateLimitPerMinute || rateLimitPerMinute <= 0) return;
  let hostname: string;
  try {
    hostname = new URL(feedUrl).hostname.toLowerCase();
  } catch {
    return;
  }
  const minIntervalMs = Math.ceil(60_000 / rateLimitPerMinute);
  const now = Date.now();
  const last = lastFetchAtMsByHost.get(hostname) ?? 0;
  const wait = Math.max(0, last + minIntervalMs - now);
  if (wait > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
  }
  lastFetchAtMsByHost.set(hostname, Date.now());
}

/** Test helper: reset throttle state between tests */
export function resetRssHostThrottleForTests(): void {
  lastFetchAtMsByHost.clear();
}
