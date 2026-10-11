import { env } from "../config/env.js";
import { createMemoryCache } from "../utils/memoryCache.js";
import { isRedisEnabled, redisGetJson, redisGetNumber, redisIncr, redisSetJson } from "./redisClient.js";

const GENERATION_KEY = "public:cache:generation";
const KEY_PREFIX_REDIS = "public:v";
const KEY_PREFIX_MEMORY = "public:m";

const l1 = createMemoryCache({
  defaultTtlMs: env.publicCacheL1TtlMs,
  maxEntries: 128,
});

let memoryGeneration = 0;
let cachedRedisGeneration = null;
let cachedRedisGenerationAt = 0;

const DEFAULT_REDIS_L2_PREFIXES = [
  "tournament:published",
  "site-content",
  "seasons:",
  "community",
];

function redisL2Prefixes() {
  const raw = env.publicCacheRedisKeyPrefixes;
  if (!raw) return DEFAULT_REDIS_L2_PREFIXES;
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Whether this logical cache key should use Upstash/Redis L2 (bandwidth-sensitive). */
export function usesRedisL2(logicalKey) {
  if (!env.publicCacheRedisL2Enabled || !isRedisEnabled()) {
    return false;
  }
  const key = String(logicalKey || "");
  return redisL2Prefixes().some((prefix) => key === prefix || key.startsWith(prefix));
}

async function resolveRedisGeneration() {
  if (!isRedisEnabled()) {
    return 0;
  }

  const now = Date.now();
  const localTtl = env.publicCacheGenerationLocalTtlMs;
  if (cachedRedisGeneration !== null && now - cachedRedisGenerationAt < localTtl) {
    return cachedRedisGeneration;
  }

  const remote = await redisGetNumber(GENERATION_KEY);
  cachedRedisGeneration = remote ?? 0;
  cachedRedisGenerationAt = now;
  return cachedRedisGeneration;
}

function storageKey(logicalKey, generation, redisL2) {
  const prefix = redisL2 ? KEY_PREFIX_REDIS : KEY_PREFIX_MEMORY;
  return `${prefix}${generation}:${logicalKey}`;
}

function readL1(logicalKey, generation, redisL2) {
  const entry = l1.get(storageKey(logicalKey, generation, redisL2));
  return entry === undefined ? undefined : entry;
}

function writeL1(logicalKey, generation, redisL2, payload, ttlMs) {
  l1.set(storageKey(logicalKey, generation, redisL2), payload, ttlMs);
}

export async function getCachedPublicPayload(logicalKey) {
  const redisL2 = usesRedisL2(logicalKey);
  const generation = redisL2 ? await resolveRedisGeneration() : memoryGeneration;
  const l1Ttl = redisL2 ? env.publicCacheL1TtlMs : env.publicCacheMemoryL1TtlMs;

  const l1Hit = readL1(logicalKey, generation, redisL2);
  if (l1Hit !== undefined) {
    return l1Hit;
  }

  if (!redisL2) {
    return undefined;
  }

  const redisHit = await redisGetJson(storageKey(logicalKey, generation, true));
  if (redisHit !== undefined) {
    writeL1(logicalKey, generation, true, redisHit, l1Ttl);
    return redisHit;
  }

  return undefined;
}

export async function setCachedPublicPayload(logicalKey, payload, ttlMs) {
  const redisL2 = usesRedisL2(logicalKey);
  const generation = redisL2 ? await resolveRedisGeneration() : memoryGeneration;
  const l1Ttl = redisL2 ? env.publicCacheL1TtlMs : env.publicCacheMemoryL1TtlMs;
  const redisTtl =
    logicalKey.startsWith("community") && env.publicCacheRedisCommunityTtlMs > 0
      ? env.publicCacheRedisCommunityTtlMs
      : ttlMs ?? env.publicCacheRedisTtlMs;

  writeL1(logicalKey, generation, redisL2, payload, l1Ttl);

  if (!redisL2) {
    return;
  }

  await redisSetJson(storageKey(logicalKey, generation, true), payload, redisTtl);
}

async function invalidatePublicCacheInternal({ redis = true, memory = true } = {}) {
  if (memory) {
    memoryGeneration += 1;
  }

  l1.clear();
  cachedRedisGeneration = null;
  cachedRedisGenerationAt = 0;

  if (redis && isRedisEnabled() && env.publicCacheRedisL2Enabled) {
    await redisIncr(GENERATION_KEY);
  }
}

/**
 * Bust public read caches after writes.
 * @param {{ redis?: boolean, memory?: boolean }} [scope]
 * - `redis`: bump shared L2 (tournament, site-content, seasons, community).
 * - `memory`: bump in-process keys (players, matches, cards, league, …).
 */
export function invalidatePublicCache(scope = {}) {
  const options =
    scope && typeof scope === "object" && ("redis" in scope || "memory" in scope)
      ? { redis: scope.redis !== false, memory: scope.memory !== false }
      : { redis: true, memory: true };

  void invalidatePublicCacheInternal(options).catch((error) => {
    console.error("[public-cache] invalidation failed:", error?.message || error);
  });
}
