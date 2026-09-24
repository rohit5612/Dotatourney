const memory = new Map();
const STORAGE_PREFIX = "bpcl-cache:";

function storageKey(key) {
  return STORAGE_PREFIX + key;
}

/** Read cached GET payload without fetching (memory or sessionStorage). */
export function peekCache(key) {
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && now < mem.expiresAt) return mem.value;

  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (now < parsed.expiresAt) {
      memory.set(key, { value: parsed.value, expiresAt: parsed.expiresAt });
      return parsed.value;
    }
  } catch {
    // Private mode / quota — memory-only is fine.
  }
  return undefined;
}

/** Last cached payload even when TTL expired (for offline / failed refresh). */
export function peekStaleCache(key) {
  const mem = memory.get(key);
  if (mem?.value !== undefined) return mem.value;

  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed?.value === undefined) return undefined;
    memory.set(key, { value: parsed.value, expiresAt: parsed.expiresAt ?? 0 });
    return parsed.value;
  } catch {
    return undefined;
  }
}

function writeCache(key, value, ttlMs, persist) {
  const expiresAt = Date.now() + ttlMs;
  memory.set(key, { value, expiresAt });
  if (!persist) return;
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify({ value, expiresAt }));
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Cached GET with stale-while-revalidate: returns cached data immediately when present,
 * then refreshes in the background.
 */
export function cachedGet(key, fetcher, {
  ttlMs = 20_000,
  persist = true,
  revalidate = true,
  /** When true, wait for refresh so callers (e.g. React hooks) get DB-fresh data. */
  awaitRevalidate = false,
} = {}) {
  const cached = peekCache(key);
  if (cached !== undefined) {
    if (revalidate) {
      const refresh = fetcher()
        .then((fresh) => {
          writeCache(key, fresh, ttlMs, persist);
          return fresh;
        })
        .catch(() => cached);
      if (awaitRevalidate) return refresh;
      void refresh;
    }
    return Promise.resolve(cached);
  }
  return fetcher()
    .then((value) => {
      writeCache(key, value, ttlMs, persist);
      return value;
    })
    .catch((err) => {
      const stale = peekStaleCache(key);
      if (stale !== undefined) return stale;
      throw err;
    });
}

export function clearCache(key) {
  memory.delete(key);
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}
