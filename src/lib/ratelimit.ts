import crypto from "crypto";

// Store hashed IPs with their submission timestamps in memory
// Automatically cleans up entries older than the window
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

const SALT = process.env.RATE_LIMIT_SALT || "menfess-default-salt-key-9283";
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 3; // Max 3 requests per 10 minutes

/**
 * Hashes an IP address using SHA-256 and a secret salt.
 * Ensures the raw IP address is never stored or logged.
 */
export function hashIp(ip: string): string {
  return crypto
    .createHmac("sha256", SALT)
    .update(ip.trim())
    .digest("hex");
}

/**
 * Checks if the hashed IP has exceeded the allowed rate limit.
 * Returns { allowed: boolean, remaining: number, resetInSeconds: number }
 */
export function checkRateLimit(hashedIp: string): {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(hashedIp);

  // Clean up expired entries periodically
  if (Math.random() < 0.1) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (now > val.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!record || now > record.resetAt) {
    rateLimitStore.set(hashedIp, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      resetInSeconds: Math.ceil(WINDOW_MS / 1000),
    };
  }

  if (record.count >= MAX_REQUESTS) {
    const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  record.count += 1;
  const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return {
    allowed: true,
    remaining: MAX_REQUESTS - record.count,
    resetInSeconds,
  };
}
