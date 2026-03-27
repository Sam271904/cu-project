type CacheEntry = {
  value?: unknown;
  expiresAt: number;
  inFlight?: Promise<unknown>;
};

const cache = new Map<string, CacheEntry>();

export async function getCached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  opts?: { force?: boolean },
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);

  if (!opts?.force && hit?.value !== undefined && hit.expiresAt > now) {
    return hit.value as T;
  }
  if (!opts?.force && hit?.inFlight) {
    return (await hit.inFlight) as T;
  }

  const inFlight = loader()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      const cur = cache.get(key);
      if (cur?.inFlight) {
        cache.set(key, { value: cur.value, expiresAt: cur.expiresAt });
      }
    });

  cache.set(key, {
    value: hit?.value,
    expiresAt: hit?.expiresAt ?? 0,
    inFlight,
  });

  return (await inFlight) as T;
}

export function invalidateCache(keys: string | string[]): void {
  const arr = Array.isArray(keys) ? keys : [keys];
  for (const k of arr) cache.delete(k);
}

