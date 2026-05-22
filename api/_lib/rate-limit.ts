import { createRequire } from "node:module";
import { Pool } from "pg";
import {
  DAILY_RECONSTRUCTION_LIMIT,
} from "./config.js";
import { HttpError } from "./http.js";

const require = createRequire(import.meta.url);
const {
  RateLimiterMemory,
  RateLimiterPostgres,
} = require("rate-limiter-flexible") as typeof import("rate-limiter-flexible");

let pool: Pool | null = null;
let postgresLimiter: InstanceType<typeof RateLimiterPostgres> | null = null;
let memoryLimiter: InstanceType<typeof RateLimiterMemory> | null = null;
let postgresDisabledForSession = false;
let hasLoggedDevFallback = false;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getMemoryLimiter() {
  memoryLimiter ??= new RateLimiterMemory({
    keyPrefix: "reconstruct_daily_dev",
    points: DAILY_RECONSTRUCTION_LIMIT,
    duration: 24 * 60 * 60,
  });

  return memoryLimiter;
}

function logDevFallback(message: string, error?: unknown) {
  if (hasLoggedDevFallback) {
    return;
  }

  hasLoggedDevFallback = true;
  console.warn(`[rate-limit] ${message}`);
  if (error) {
    console.warn(error);
  }
}

function getPool() {
  if (postgresDisabledForSession) {
    return null;
  }

  if (!pool) {
    const connectionString = process.env.SUPABASE_DATABASE_URL;
    if (!connectionString) {
      return null;
    }

    try {
      new URL(connectionString);
    } catch (error) {
      if (isProduction()) {
        throw new HttpError(503, "SUPABASE_DATABASE_URL is invalid for rate limiting.");
      }

      postgresDisabledForSession = true;
      logDevFallback(
        "Invalid SUPABASE_DATABASE_URL detected. Falling back to in-memory rate limiting for local development.",
        error,
      );
      return null;
    }

    pool = new Pool({
      connectionString,
      ssl:
        process.env.SUPABASE_DATABASE_SSL === "false"
          ? false
          : { rejectUnauthorized: false },
      max: 2,
    });
  }

  return pool;
}

function getLimiter() {
  const storeClient = getPool();

  if (storeClient) {
    postgresLimiter ??= new RateLimiterPostgres({
      storeClient,
      tableName: "rate_limiter_flexible",
      tableCreated: true,
      keyPrefix: "reconstruct_daily",
      points: DAILY_RECONSTRUCTION_LIMIT,
      duration: 24 * 60 * 60,
      clearExpiredByTimeout: false,
    });
    return postgresLimiter;
  }

  if (isProduction()) {
    throw new HttpError(503, "SUPABASE_DATABASE_URL is not configured for rate limiting.");
  }

  return getMemoryLimiter();
}

export async function enforceUserRateLimit(userId: string) {
  const limiter = getLimiter();

  try {
    const result = await limiter.consume(`reconstruct:${userId}`);
    return {
      limit: DAILY_RECONSTRUCTION_LIMIT,
      remaining: Math.max(result.remainingPoints, 0),
      resetSeconds: Math.max(Math.ceil(result.msBeforeNext / 1000), 1),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (isProduction()) {
        throw new HttpError(503, "Rate limiter is unavailable.");
      }

      if (limiter !== memoryLimiter) {
        postgresDisabledForSession = true;
        postgresLimiter = null;
        pool = null;
        logDevFallback(
          "Postgres-backed rate limiting failed in local development. Falling back to in-memory rate limiting.",
          error,
        );

        const fallbackResult = await getMemoryLimiter().consume(`reconstruct:${userId}`);
        return {
          limit: DAILY_RECONSTRUCTION_LIMIT,
          remaining: Math.max(fallbackResult.remainingPoints, 0),
          resetSeconds: Math.max(Math.ceil(fallbackResult.msBeforeNext / 1000), 1),
        };
      }

      throw error;
    }

    const retrySeconds =
      typeof error === "object" &&
      error !== null &&
      "msBeforeNext" in error &&
      typeof error.msBeforeNext === "number"
        ? Math.max(Math.ceil(error.msBeforeNext / 1000), 1)
        : 60;

    throw new HttpError(429, "Daily reconstruction limit exceeded.", {
      "Retry-After": String(retrySeconds),
      "X-RateLimit-Limit": String(DAILY_RECONSTRUCTION_LIMIT),
      "X-RateLimit-Remaining": "0",
    });
  }
}
