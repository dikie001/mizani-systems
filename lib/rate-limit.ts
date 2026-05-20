import { NextRequest, NextResponse } from "next/server"

interface RateLimitEntry {
  count: number
  resetTime: number
  violations: number // Track abuse for progressive penalties
}

type EndpointType = "auth" | "api" | "admin" | "payment" | "upload" | "search"

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  type: EndpointType
}

// Separate stores for each endpoint type
const stores: Record<EndpointType, Map<string, RateLimitEntry>> = {
  auth: new Map(),
  api: new Map(),
  admin: new Map(),
  payment: new Map(),
  upload: new Map(),
  search: new Map(),
}

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now()
  for (const store of Object.values(stores)) {
    for (const [key, entry] of store.entries()) {
      if (entry.resetTime < now) {
        store.delete(key)
      }
    }
  }
}, 60000)

/**
 * Get client identifier: IP + User ID if authenticated
 * Use both for better per-user tracking of authenticated requests
 */
function getClientKey(request: NextRequest): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"

  const userId = request.headers.get("x-user-id")
  return userId ? `${ip}:${userId}` : ip
}

/**
 * Determine endpoint type from pathname
 */
function getEndpointType(pathname: string): EndpointType {
  if (
    pathname.includes("/auth/") ||
    pathname.includes("/signup") ||
    pathname.includes("/login")
  ) {
    return "auth"
  }

  if (pathname.includes("/super-admin/") || pathname.includes("/admin/")) {
    return "admin"
  }

  if (
    pathname.includes("/payments/") ||
    pathname.includes("/subscriptions/")
  ) {
    return "payment"
  }

  if (pathname.includes("/upload")) {
    return "upload"
  }

  if (pathname.includes("/search")) {
    return "search"
  }

  return "api"
}

/**
 * Get rate limit config based on endpoint type
 * Production-grade defaults from SaaS best practices
 */
function getConfig(type: EndpointType): RateLimitConfig {
  const configs: Record<EndpointType, RateLimitConfig> = {
    // Auth: Prevent brute force attacks
    auth: {
      windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || "900000"), // 15 min
      maxRequests: parseInt(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS || "5"),
      type: "auth",
    },
    // General API: Balanced for authenticated users
    api: {
      windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || "60000"), // 1 min
      maxRequests: parseInt(process.env.RATE_LIMIT_API_MAX_REQUESTS || "120"),
      type: "api",
    },
    // Admin: Fewer requests for sensitive operations
    admin: {
      windowMs: parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS || "60000"), // 1 min
      maxRequests: parseInt(process.env.RATE_LIMIT_ADMIN_MAX_REQUESTS || "60"),
      type: "admin",
    },
    // Payment: Very strict to prevent fraud
    payment: {
      windowMs: parseInt(process.env.RATE_LIMIT_PAYMENT_WINDOW_MS || "300000"), // 5 min
      maxRequests: parseInt(process.env.RATE_LIMIT_PAYMENT_MAX_REQUESTS || "5"),
      type: "payment",
    },
    // File uploads: Prevent storage abuse
    upload: {
      windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || "60000"), // 1 min
      maxRequests: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX_REQUESTS || "10"),
      type: "upload",
    },
    // Search: Allow more requests for legitimate use
    search: {
      windowMs: parseInt(process.env.RATE_LIMIT_SEARCH_WINDOW_MS || "60000"), // 1 min
      maxRequests: parseInt(process.env.RATE_LIMIT_SEARCH_MAX_REQUESTS || "60"),
      type: "search",
    },
  }

  return configs[type]
}

/**
 * Check rate limit with progressive penalties for repeated abuse
 */
function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; resetTime: number; violations: number } {
  const now = Date.now()
  const store = stores[config.type]
  let entry = store.get(key)

  // New or expired entry
  if (!entry || entry.resetTime < now) {
    store.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      violations: 0,
    })
    return { allowed: true, resetTime: 0, violations: 0 }
  }

  // Increment count
  if (entry.count < config.maxRequests) {
    entry.count++
    return { allowed: true, resetTime: 0, violations: entry.violations }
  }

  // Rate limited - apply progressive penalties
  entry.violations += 1

  // Progressive penalty: after 3 violations, exponentially increase block time
  if (entry.violations >= 3) {
    const penaltyMinutes = Math.min(entry.violations * 5, 60) // Max 60 min
    entry.resetTime = now + penaltyMinutes * 60000
  }

  return {
    allowed: false,
    resetTime: entry.resetTime,
    violations: entry.violations,
  }
}

/**
 * Format milliseconds to readable duration
 */
function formatTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`
  return `${Math.ceil(minutes / 60)} hour${Math.ceil(minutes / 60) !== 1 ? "s" : ""}`
}

/**
 * Production-grade rate limiting middleware
 * - Different limits per endpoint type
 * - IP + User ID tracking for authenticated users
 * - Progressive penalties for repeated abuse
 * - HTTP 429 with clear messaging
 */
export async function rateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  // Check if rate limiting is enabled
  if (process.env.RATE_LIMITING_ENABLED === "false") {
    return null
  }

  const pathname = request.nextUrl.pathname

  // Skip non-API routes and static assets
  if (!pathname.startsWith("/api/")) {
    return null
  }

  // Don't rate limit static assets
  if (
    pathname.includes("_next") ||
    pathname.includes(".png") ||
    pathname.includes(".jpg")
  ) {
    return null
  }

  // Get client key (IP or IP:userId)
  const clientKey = getClientKey(request)

  // Determine endpoint type and get config
  const endpointType = getEndpointType(pathname)
  const config = getConfig(endpointType)

  // Check rate limit
  const { allowed, resetTime, violations } = checkRateLimit(clientKey, config)

  if (!allowed) {
    const retryAfterMs = Math.max(0, resetTime - Date.now())
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))

    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `Too many requests. Please try again in ${formatTime(retryAfterMs)}.`,
        details: {
          limit: config.maxRequests,
          window: formatTime(config.windowMs),
          retryAfter: retryAfterSeconds,
          type: endpointType,
          violations, // Show how many times they've been blocked (for UX feedback)
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
          "X-RateLimit-Limit": config.maxRequests.toString(),
          "X-RateLimit-Window": `${config.windowMs}ms`,
        },
      }
    )
  }

  return null
}

/**
 * Check if rate limiting is enabled globally
 */
export function isRateLimitingEnabled(): boolean {
  return process.env.RATE_LIMITING_ENABLED !== "false"
}
