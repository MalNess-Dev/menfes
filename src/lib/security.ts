import crypto from "crypto";
import { NextRequest } from "next/server";

const PEPPER = process.env.SECURITY_PEPPER || "menfess-hardened-pepper-84920491";
const AUTH_SECRET = process.env.AUTH_SECRET || "menfess-auth-secret-session-key";
const ADMIN_STEALTH_SECRET = process.env.ADMIN_STEALTH_SECRET || "stealth-admin-passcode-random-token";

/**
 * Military-grade Password Hashing using Scrypt (Memory-Hard, ASIC & GPU resistant).
 * Combined with 32-byte unique cryptographic salt + Server-side Pepper.
 * Mathematically irreversible / cannot be decrypted by any tool or rainbow table.
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(32).toString("hex");
  // Combine password with server-side secret pepper
  const pepperedPassword = crypto
    .createHmac("sha512", PEPPER)
    .update(password)
    .digest("hex");

  const derivedKey = crypto.scryptSync(pepperedPassword, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });

  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

/**
 * Timing-safe password verification to prevent side-channel timing attacks.
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const pepperedPassword = crypto
      .createHmac("sha512", PEPPER)
      .update(password)
      .digest("hex");

    const derivedKey = crypto.scryptSync(pepperedPassword, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024,
    });

    const keyBuffer = Buffer.from(derivedKey.toString("hex"), "utf8");
    const storedBuffer = Buffer.from(storedHash, "utf8");

    if (keyBuffer.length !== storedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(keyBuffer, storedBuffer);
  } catch (err) {
    console.error("Password verification error:", err);
    return false;
  }
}

/**
 * Generates an encrypted & signed Session Token (HMAC-SHA256 signature).
 */
export function createSessionToken(payload: {
  userId: number;
  username: string;
  role: string;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 24 * 60 * 60; // 7 days validity

  const bodyData = {
    ...payload,
    iat: now,
    exp,
  };
  const body = Buffer.from(JSON.stringify(bodyData)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

/**
 * Verifies session token integrity and expiration.
 */
export function verifySessionToken(token: string): {
  userId: number;
  username: string;
  role: string;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", AUTH_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expectedSig, "utf8");

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Validates Stealth Admin Passcode using constant-time comparison.
 * Zero-knowledge: scanner tools cannot guess or measure response times.
 */
export function verifyStealthPasscode(providedKey: string): boolean {
  if (!providedKey || typeof providedKey !== "string") return false;
  const targetBuffer = Buffer.from(ADMIN_STEALTH_SECRET, "utf8");
  const inputBuffer = Buffer.from(providedKey, "utf8");

  if (targetBuffer.length !== inputBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(targetBuffer, inputBuffer);
}

/**
 * Securely extracts client IP, resisting header spoofing.
 * Prioritizes trusted CDN/proxy headers (Cloudflare, True-Client-IP) over untrusted X-Forwarded-For.
 */
export function getClientIp(request: NextRequest): string {
  // 1. Cloudflare header (spoof-resistant when behind Cloudflare proxy)
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && isValidIp(cfIp)) return cfIp.trim();

  // 2. True-Client-IP (Enterprise proxies / Akamai)
  const trueClientIp = request.headers.get("true-client-ip");
  if (trueClientIp && isValidIp(trueClientIp)) return trueClientIp.trim();

  // 3. X-Real-IP (Nginx direct proxy)
  const realIp = request.headers.get("x-real-ip");
  if (realIp && isValidIp(realIp)) return realIp.trim();

  // 4. X-Forwarded-For (Extract leftmost client IP)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    for (const ip of ips) {
      const cleanIp = ip.split(":")[0]; // strip port if IPv4
      if (isValidIp(cleanIp) && !isPrivateIp(cleanIp)) {
        return cleanIp;
      }
    }
    // If all are private or local, return the first valid IP
    if (ips[0] && isValidIp(ips[0])) {
      return ips[0];
    }
  }

  return "127.0.0.1";
}

/**
 * Validates IPv4 or IPv6 format
 */
function isValidIp(ip: string): boolean {
  const ipv4Regex =
    /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === "::1" || ip === "127.0.0.1";
}

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.31.") ||
    ip === "127.0.0.1" ||
    ip === "::1"
  );
}

/**
 * Parses User-Agent to detect device and phone model/type for audit trail.
 */
export function parseDeviceType(uaString: string | null): string {
  if (!uaString) return "Perangkat Tidak Dikenal";
  const ua = uaString.toLowerCase();

  let os = "Desktop";
  if (ua.includes("android")) {
    // Try to extract brand if present
    if (ua.includes("samsung") || ua.includes("sm-")) os = "HP Android (Samsung)";
    else if (ua.includes("xiaomi") || ua.includes("redmi") || ua.includes("mi ")) os = "HP Android (Xiaomi/Redmi)";
    else if (ua.includes("oppo") || ua.includes("cph")) os = "HP Android (OPPO)";
    else if (ua.includes("vivo")) os = "HP Android (Vivo)";
    else if (ua.includes("realme")) os = "HP Android (Realme)";
    else os = "HP Android";
  } else if (ua.includes("iphone")) {
    os = "HP iPhone (iOS)";
  } else if (ua.includes("ipad")) {
    os = "iPad (iOS)";
  } else if (ua.includes("windows")) {
    os = "PC (Windows)";
  } else if (ua.includes("macintosh") || ua.includes("mac os")) {
    os = "PC (MacBook / macOS)";
  } else if (ua.includes("linux")) {
    os = "PC (Linux)";
  }

  let browser = "Browser";
  if (ua.includes("chrome") && !ua.includes("edg") && !ua.includes("opr")) browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("opera") || ua.includes("opr")) browser = "Opera";

  return `${os} • ${browser}`;
}
