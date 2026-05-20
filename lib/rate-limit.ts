import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix: string; // Prefix for cache key
}

// In-memory store for rate limiting
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }[]
>();

// Clean up old entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entries] of rateLimitStore.entries()) {
    const filtered = entries.filter((entry) => entry.resetTime > now);
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }
}, 60000); // Clean up every minute

// Cleanup on process exit
if (typeof process !== "undefined") {
  process.on("exit", () => clearInterval(cleanupInterval));
}

/**
 * Check if a request exceeds rate limit
 * @param key - Unique identifier for rate limiting (e.g., IP, user ID)
 * @param config - Rate limit configuration
 * @returns true if request is allowed, false if rate limited
 */
function isAllowed(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const storeKey = `${config.keyPrefix}:${key}`;

  let entries = rateLimitStore.get(storeKey) || [];

  // Remove expired entries
  entries = entries.filter((entry) => entry.resetTime > now);

  // Check if we've exceeded the limit
  if (entries.length >= config.maxRequests) {
    rateLimitStore.set(storeKey, entries);
    return false;
  }

  // Add new entry
  entries.push({
    count: 1,
    resetTime: now + config.windowMs,
  });

  rateLimitStore.set(storeKey, entries);
  return true;
}

/**
 * Get the client identifier (IP address or user ID)
 */
function getClientKey(request: NextRequest, useUserIdIfAvailable = false): string {
  // Try to get user ID from request headers (set by middleware or auth)
  if (useUserIdIfAvailable) {
    const userId = request.headers.get("x-user-id");
    if (userId) return userId;
  }

  // Fall back to IP address
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Create a rate limit middleware for API routes
 */
export function createRateLimitMiddleware(
  config: Partial<RateLimitConfig> = {}
) {
  const finalConfig: RateLimitConfig = {
    windowMs: (config.windowMs || 15 * 60 * 1000), // 15 minutes default
    maxRequests: config.maxRequests || 100,
    keyPrefix: config.keyPrefix || "api",
  };

  return async (
    request: NextRequest,
    useUserIdIfAvailable = false
  ): Promise<{ allowed: boolean; response?: NextResponse }> => {
    const key = getClientKey(request, useUserIdIfAvailable);
    const allowed = isAllowed(key, finalConfig);

    if (!allowed) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: "Too many requests",
            message: "Rate limit exceeded. Please try again later.",
            retryAfter: Math.ceil(finalConfig.windowMs / 1000),
          },
          {
            status: 429,
            headers: {
              "Retry-After": Math.ceil(finalConfig.windowMs / 1000).toString(),
            },
          }
        ),
      };
    }

    return { allowed: true };
  };
}

/**
 * Get rate limit config from environment variables
 */
export function getRateLimitConfig(endpoint?: string): RateLimitConfig {
  const defaultWindowMs = parseFloat(
    process.env.RATE_LIMIT_WINDOW_MS || (15 * 60 * 1000).toString()
  );
  const defaultMaxRequests = parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || "100",
    10
  );

  // If endpoint-specific config exists, use it
  if (endpoint) {
    const envKey = endpoint.toUpperCase().replace(/\//g, "_");
    const windowMs = parseFloat(
      process.env[`RATE_LIMIT_${envKey}_WINDOW_MS`] ||
        defaultWindowMs.toString()
    );
    const maxRequests = parseInt(
      process.env[`RATE_LIMIT_${envKey}_MAX_REQUESTS`] ||
        defaultMaxRequests.toString(),
      10
    );

    return {
      windowMs,
      maxRequests,
      keyPrefix: endpoint,
    };
  }

  return {
    windowMs: defaultWindowMs,
    maxRequests: defaultMaxRequests,
    keyPrefix: "api",
  };
}

/**
 * Check if rate limiting is enabled
 */
export function isRateLimitingEnabled(): boolean {
  return process.env.RATE_LIMITING_ENABLED !== "false";
}
