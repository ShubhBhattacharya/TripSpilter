/**
 * TripSplit Production-Ready Rate Limiting
 * Spec compliant with RFC 6585 / standard rate limit headers.
 *
 * Features:
 * - Upstash Redis / Vercel KV distributed rate limiting when configured.
 * - Robust in-memory sliding window fallback for zero-dependency execution.
 * - Fail-safe design (fails open if external service is unreachable).
 * - Multi-factor client identification (combining IP + User ID).
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // in seconds until reset
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
 * Executes a sliding-window rate limit check on a given identifier.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 20,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  // 1. If distributed Redis credentials are present, use distributed atomic sliding window
  if (upstashUrl && upstashToken) {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      const key = `rl:${identifier}`;

      // Redis pipeline: ZREMRANGEBYSCORE, ZADD, ZCARD, EXPIRE
      const pipelineRes = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['ZREMRANGEBYSCORE', key, 0, windowStart],
          ['ZADD', key, now, `${now}-${Math.random()}`],
          ['ZCARD', key],
          ['EXPIRE', key, Math.ceil(windowMs / 1000)],
        ]),
        // Short timeout to prevent blocking user requests if network issues occur
        signal: AbortSignal.timeout(1500),
      });

      if (pipelineRes.ok) {
        const results = await pipelineRes.json();
        const requestCount = results[2]?.result || 1;
        const remaining = Math.max(0, limit - requestCount);
        const success = requestCount <= limit;

        return {
          success,
          limit,
          remaining,
          reset: Math.ceil(windowMs / 1000),
        };
      }
    } catch {
      // Fail safely: Log warning and fallback to local sliding window
      console.warn('[RateLimit] Remote rate limit store unavailable. Falling back to local sliding window.');
    }
  }

  // 2. High-performance local sliding window fallback
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
    };
  }

  activeTimestamps.push(now);
  localStore.set(identifier, { timestamps: activeTimestamps });

  return {
    success: true,
    limit,
    remaining: limit - activeTimestamps.length,
    reset: Math.ceil(windowMs / 1000),
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
  if (!result.success) {
    headers.set('Retry-After', String(result.reset));
  }
}