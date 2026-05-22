/**
 * Small in-process TTL cache (no Redis). Evicts oldest entry when full.
 */
export function createMemoryCache({ defaultTtlMs = 8_000, maxEntries = 32 } = {}) {
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key, value, ttlMs = defaultTtlMs) {
    if (store.size >= maxEntries && !store.has(key)) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  function clear() {
    store.clear();
  }

  return { get, set, clear };
}
