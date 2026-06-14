import { env } from "../config/env.js";
import { createMemoryCache } from "../utils/memoryCache.js";
import { isRedisEnabled, redisGetJson, redisGetNumber, redisIncr, redisSetJson } from "./redisClient.js";

const GENERATION_KEY = "public:cache:generation";
const KEY_PREFIX = "public:v";

const l1 = createMemoryCache({
  defaultTtlMs: env.publicCacheL1TtlMs,
  maxEntries: 64,
});

let memoryGeneration = 0;
let cachedGeneration = null;
let cachedGenerationAt = 0;

async function resolveGeneration() {
  if (!isRedisEnabled()) {
    return memoryGeneration;
  }

  const now = Date.now();
  if (cachedGeneration !== null && now - cachedGenerationAt < 3_000) {
    return cachedGeneration;
  }

  const remote = await redisGetNumber(GENERATION_KEY);
  cachedGeneration = remote ?? 0;
  cachedGenerationAt = now;
  return cachedGeneration;
}

function storageKey(logicalKey, generation) {
  return `${KEY_PREFIX}${generation}:${logicalKey}`;
}

function readL1(logicalKey, generation) {
  const entry = l1.get(storageKey(logicalKey, generation));
  return entry === undefined ? undefined : entry;
}

function writeL1(logicalKey, generation, payload, ttlMs) {
  l1.set(storageKey(logicalKey, generation), payload, ttlMs);
}

export async function getCachedPublicPayload(logicalKey) {
  const generation = await resolveGeneration();
  const l1Hit = readL1(logicalKey, generation);
  if (l1Hit !== undefined) {
    return l1Hit;
  }

  if (!isRedisEnabled()) {
    return undefined;
  }

  const redisHit = await redisGetJson(storageKey(logicalKey, generation));
  if (redisHit !== undefined) {
    writeL1(logicalKey, generation, redisHit, env.publicCacheL1TtlMs);
    return redisHit;
  }

  return undefined;
}

export async function setCachedPublicPayload(logicalKey, payload, ttlMs = env.publicCacheRedisTtlMs) {
  const generation = await resolveGeneration();
  writeL1(logicalKey, generation, payload, env.publicCacheL1TtlMs);

  if (!isRedisEnabled()) {
    return;
  }

  await redisSetJson(storageKey(logicalKey, generation), payload, ttlMs);
}

async function invalidatePublicCacheInternal() {
  l1.clear();
  cachedGeneration = null;
  cachedGenerationAt = 0;

  if (isRedisEnabled()) {
    await redisIncr(GENERATION_KEY);
    return;
  }

  memoryGeneration += 1;
}

/** Bust public read caches after tournament / bracket / registration writes. */
export function invalidatePublicCache() {
  void invalidatePublicCacheInternal().catch((error) => {
    console.error("[public-cache] invalidation failed:", error?.message || error);
  });
}
