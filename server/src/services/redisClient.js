import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient } from "redis";
import { env } from "../config/env.js";

/** @type {"memory-only" | "redis-url" | "upstash-rest"} */
let mode = "memory-only";
/** @type {import("redis").RedisClientType | null} */
let nodeClient = null;
/** @type {import("@upstash/redis").Redis | null} */
let upstashClient = null;

function redisUrlHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "redis";
  }
}

export function getRedisMode() {
  return mode;
}

export function isRedisEnabled() {
  return mode !== "memory-only";
}

function delayReject(ms, label) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
}

function withInitTimeout(promise, ms, label) {
  return Promise.race([promise, delayReject(ms, label)]);
}

async function resetNodeClient() {
  if (!nodeClient) return;
  try {
    if (nodeClient.isOpen) await nodeClient.disconnect();
  } catch {
    // ignore teardown errors
  }
  nodeClient = null;
}

export async function initRedis() {
  const restUrl = env.upstashRedisRestUrl || (env.redisUrl?.startsWith("https://") ? env.redisUrl : "");
  const restToken = env.upstashRedisRestToken;

  if (restUrl && restToken) {
    upstashClient = new UpstashRedis({
      url: restUrl,
      token: restToken,
    });
    await withInitTimeout(upstashClient.ping(), 8_000, "Upstash Redis ping");
    mode = "upstash-rest";
    return { mode, label: "Upstash Redis (REST)" };
  }

  if (env.redisUrl) {
    if (env.redisUrl.startsWith("https://")) {
      throw new Error(
        "REDIS_URL is an HTTPS REST endpoint. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN instead (or use the rediss:// Redis URL from Upstash).",
      );
    }

    nodeClient = createClient({
      url: env.redisUrl,
      /** Local Redis / older servers may not support RESP3 HELLO. */
      RESP: 2,
      socket: {
        connectTimeout: 8_000,
        reconnectStrategy: () => false,
      },
    });
    nodeClient.on("error", (error) => {
      console.error("[redis] client error:", error?.message || error);
    });

    try {
      await withInitTimeout(nodeClient.connect(), 8_000, "Redis connect");
      await withInitTimeout(nodeClient.ping(), 8_000, "Redis ping");
    } catch (error) {
      await resetNodeClient();
      throw error;
    }

    mode = "redis-url";
    return { mode, label: `Redis (${redisUrlHost(env.redisUrl)})` };
  }

  return { mode, label: "in-memory only (set REDIS_URL or Upstash REST vars)" };
}

export async function redisGetNumber(key) {
  if (mode === "upstash-rest") {
    const value = await upstashClient.get(key);
    return value == null ? null : Number(value);
  }
  if (mode === "redis-url") {
    const raw = await nodeClient.get(key);
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function redisIncr(key) {
  if (mode === "upstash-rest") {
    return Number(await upstashClient.incr(key));
  }
  if (mode === "redis-url") {
    return Number(await nodeClient.incr(key));
  }
  return null;
}

export async function redisGetJson(key) {
  if (mode === "upstash-rest") {
    return (await upstashClient.get(key)) ?? undefined;
  }
  if (mode === "redis-url") {
    const raw = await nodeClient.get(key);
    if (raw == null) return undefined;
    return JSON.parse(raw);
  }
  return undefined;
}

export async function redisSetJson(key, value, ttlMs) {
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
  if (mode === "upstash-rest") {
    await upstashClient.set(key, value, { ex: ttlSeconds });
    return;
  }
  if (mode === "redis-url") {
    await nodeClient.set(key, JSON.stringify(value), { PX: ttlMs });
  }
}
