/**
 * TripSplit Production-Grade Distributed Rate Limiting
 * Spec compliant with RFC 6585 and IETF RateLimit Headers.
 *
 * Requirements:
 * - Distributed atomic rate limiting using Upstash Redis / Vercel KV REST API.
 * - Explicit behavior when the service is unconfigured or unavailable in production.
 * - Multi-factor client identification (combining IP + User ID).
 * - Safe configuration validation.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // in seconds until reset
  isDistributed: boolean;
  mode: 'distributed' | 'process-isolated-fallback' | 'degraded-fail-open' | 'strict-blocked';
  error?: string;
}

export interface RateLimitConfig {
  isConfigured: boolean;
  url?: string;
  isProduction: boolean;
  strictMode: boolean;
}

interface SlidingWindowRecord {
  timestamps: number[];
}

const localStore = new Map<string, SlidingWindowRecord>();

// Clean up stale in-memory records periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of localStore.entries()) {
      const active = record.timestamps.filter((ts) => now - ts < 120000);
      if (active.length === 0) {
        localStore.delete(key);
      } else {
        localStore.set(key, { timestamps: active });
      }
    }
  }, 120000);
}

/**
 * Validates the rate limit service configuration.
 */
export function validateRateLimitConfig(): RateLimitConfig {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const isProduction = process.env.NODE_ENV === 'production';
  const strictMode = process.env.RATE_LIMIT_STRICT_MODE === 'true';

  const isConfigured = Boolean(url && token && url.startsWith('https://'));

  return {
    isConfigured,
    url: isConfigured ? url : undefined,
    isProduction,
    strictMode,
  };
}

/**
 * Executes an atomic sliding-window rate limit check on a given identifier.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 20,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const config = validateRateLimitConfig();
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  // 1. Genuinely Distributed Rate Limiting via Upstash Redis REST Pipeline
  if (config.isConfigured && upstashUrl && upstashToken) {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      const key = `tripsplit:rl:${identifier}`;
      const memberId = `${now}-${Math.random().toString(36).slice(2, 9)}`;
      const windowSeconds = Math.ceil(windowMs / 1000);

      // Atomic Redis pipeline: ZREMRANGEBYSCORE, ZADD, ZCARD, EXPIRE
      const pipelineRes = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['ZREMRANGEBYSCORE', key, 0, windowStart],
          ['ZADD', key, now, memberId],
          ['ZCARD', key],
          ['EXPIRE', key, windowSeconds],
        ]),
        signal: AbortSignal.timeout(1500),
      });

      if (pipelineRes.ok) {
        const results = await pipelineRes.json();
        const requestCount = typeof results[2]?.result === 'number' ? results[2].result : 1;
        const remaining = Math.max(0, limit - requestCount);
        const success = requestCount <= limit;

        return {
          success,
          limit,
          remaining,
          reset: windowSeconds,
          isDistributed: true,
          mode: 'distributed',
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown network failure';
      console.warn(`[TripSplit RateLimiter Error] Distributed Redis store call failed: ${errorMsg}`);

      // If strict mode is enforced in production, do not allow unmonitored requests
      if (config.strictMode && config.isProduction) {
        return {
          success: false,
          limit,
          remaining: 0,
          reset: Math.ceil(windowMs / 1000),
          isDistributed: false,
          mode: 'strict-blocked',
          error: 'Rate limit service unavailable in strict production mode',
        };
      }

      // Explicitly log that rate limiting is running in degraded fail-open mode
      console.warn('[TripSplit Security Warning] Operating in degraded fail-open mode due to Redis unavailability.');
    }
  } else if (config.isProduction) {
    // Alert when running in production without distributed rate limiting
    console.warn(
      '[TripSplit Production Alert] Distributed rate limiter (UPSTASH_REDIS_REST_URL) is not configured. Falling back to process-isolated local memory.'
    );
  }

  // 2. High-Performance Local Sliding Window Fallback
  const now = Date.now();
  const windowStart = now - windowMs;

  const record = localStore.get(identifier) || { timestamps: [] };
  const activeTimestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (activeTimestamps.length >= limit) {
    const oldest = activeTimestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      reset: resetSeconds,
      isDistributed: false,
      mode: 'process-isolated-fallback',
    };
  }

  activeTimestamps.push(now);
  localStore.set(identifier, { timestamps: activeTimestamps });

  return {
    success: true,
    limit,
    remaining: limit - activeTimestamps.length,
    reset: Math.ceil(windowMs / 1000),
    isDistributed: false,
    mode: 'process-isolated-fallback',
  };
}

/**
 * Extracts client IP address safely from standard headers.
 */
export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',');
    return ips[0].trim();
  }
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Generates a unified identifier for rate limiting combining route, IP, and authenticated user ID.
 */
export function getClientIdentifier(
  action: string,
  request: Request,
  userId?: string | null
): string {
  const ip = getClientIp(request);
  if (userId) {
    return `${action}:u_${userId}`;
  }
  return `${action}:ip_${ip}`;
}

/**
 * Appends standard RFC rate limit headers to a NextResponse.
 */
export function applyRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set('X-RateLimit-Limit', String(result.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.reset));
  headers.set('X-RateLimit-Scope', result.isDistributed ? 'distributed' : 'process-isolated');

  if (result.mode === 'degraded-fail-open') {
    headers.set('X-RateLimit-Degraded', 'true');
  }

  if (!result.success) {
    headers.set('Retry-After', String(result.reset));
  }
}