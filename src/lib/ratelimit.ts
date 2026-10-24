import crypto from "crypto";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

const SALT = process.env.RATE_LIMIT_SALT || "menfess-default-salt-key-9283";
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes window
const MAX_REQUESTS = 3; // Max 3 requests per 10 minutes

/**
 * Hashes an IP address using HMAC-SHA256 with a secret salt.
 * Ensures raw IP addresses are never exposed or stored in plaintext.
 */
export function hashIp(ip: string): string {
  return crypto
    .createHmac("sha256", SALT)
    .update(ip.trim())
    .digest("hex");
}

/**
 * Checks if a given key (session ID or hashed IP) has exceeded the rate limit.
 * Returns { allowed: boolean, remaining: number, resetInSeconds: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = MAX_REQUESTS,
  windowMs: number = WINDOW_MS
): {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Clean up expired entries periodically (10% chance per call)
  if (Math.random() < 0.1) {
    for (const [k, val] of rateLimitStore.entries()) {
      if (now > val.resetAt) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= maxRequests) {
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
    remaining: maxRequests - record.count,
    resetInSeconds,
  };
}

/**
 * Combined rate limiter checking both Session Token and Hashed Client IP.
 * Prevents spamming even if cookies are cleared or proxies are rotated.
 */
export function checkSessionAndIpLimit(
  sessionId: string,
  hashedIp: string,
  maxRequests: number = MAX_REQUESTS
): {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
  reason?: "session" | "ip";
} {
  // Check session rate limit
  const sessionResult = checkRateLimit(`session:${sessionId}`, maxRequests);
  if (!sessionResult.allowed) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: sessionResult.resetInSeconds,
      reason: "session",
    };
  }

  // Check IP rate limit
  const ipResult = checkRateLimit(`ip:${hashedIp}`, maxRequests);
  if (!ipResult.allowed) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: ipResult.resetInSeconds,
      reason: "ip",
    };
  }

  return {
    allowed: true,
    remaining: Math.min(sessionResult.remaining, ipResult.remaining),
    resetInSeconds: Math.max(sessionResult.resetInSeconds, ipResult.resetInSeconds),
  };
}
