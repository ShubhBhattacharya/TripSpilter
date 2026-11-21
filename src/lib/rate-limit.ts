/**
 * In-memory sliding-window rate limiter for production Next.js API Routes
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      const filtered = record.timestamps.filter((ts) => now - ts < 60000);
      if (filtered.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, { timestamps: filtered });
      }
    }
  }, 300000);
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export function checkRateLimit(
  identifier: string,
  limit: number = 20,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const record = rateLimitStore.get(identifier) || { timestamps: [] };

  // Keep only timestamps within current window
  const activeTimestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (activeTimestamps.length >= limit) {
    const oldest = activeTimestamps[0];
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }

  activeTimestamps.push(now);
  rateLimitStore.set(identifier, { timestamps: activeTimestamps });

  return {
    success: true,
    limit,
    remaining: limit - activeTimestamps.length,
    reset: Math.ceil(windowMs / 1000),
  };
}

export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp.trim();
  }
  return '127.0.0.1';
}
