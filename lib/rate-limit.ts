import { NextRequest, NextResponse } from "next/server"

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Store for GLOBAL rate limiting (per IP, across all endpoints)
const globalStore = new Map<string, RateLimitEntry>()

// Store for endpoint-specific rate limiting (optional, stricter limits)
const endpointStore = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  
  // Clean global store
  for (const [key, entry] of globalStore.entries()) {
    if (entry.resetTime < now) {
      globalStore.delete(key)
    }
  }
  
  // Clean endpoint store
  for (const [key, entry] of endpointStore.entries()) {
    if (entry.resetTime < now) {
      endpointStore.delete(key)
    }
  }
}, 60000)

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

/**
 * Get global rate limit config from environment
 */
function getGlobalConfig(): { windowMs: number; maxRequests: number } {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000")
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100")
  return { windowMs, maxRequests }
}

/**
 * Get endpoint-specific rate limit config (if stricter than global)
 */
function getEndpointConfig(endpoint: string): { windowMs: number; maxRequests: number } | null {
  const envKey = endpoint
    .toUpperCase()
    .replace(/\//g, "_")
    .replace(/[^A-Z0-9_]/g, "")
  
  const windowMs = process.env[`RATE_LIMIT_${envKey}_WINDOW_MS`]
  const maxRequests = process.env[`RATE_LIMIT_${envKey}_MAX_REQUESTS`]

  // Only return if both are defined (endpoint has custom limits)
  if (windowMs && maxRequests) {
    return {
      windowMs: parseInt(windowMs),
      maxRequests: parseInt(maxRequests),
    }
  }
  
  return null
}

/**
 * Check global rate limit (per IP, across all endpoints)
 */
function checkGlobalRateLimit(
  ip: string,
  config: { windowMs: number; maxRequests: number }
): { allowed: boolean; resetTime: number } {
  const now = Date.now()
  const entry = globalStore.get(ip)

  // New or expired entry
  if (!entry || entry.resetTime < now) {
    globalStore.set(ip, { count: 1, resetTime: now + config.windowMs })
    return { allowed: true, resetTime: 0 }
  }

  // Increment count
  if (entry.count < config.maxRequests) {
    entry.count++
    return { allowed: true, resetTime: 0 }
  }

  // Rate limited
  return { allowed: false, resetTime: entry.resetTime }
}

/**
 * Check endpoint-specific rate limit (if configured)
 */
function checkEndpointRateLimit(
  ip: string,
  endpoint: string,
  config: { windowMs: number; maxRequests: number }
): { allowed: boolean; resetTime: number } {
  const now = Date.now()
  const storeKey = `${endpoint}:${ip}`
  const entry = endpointStore.get(storeKey)

  // New or expired entry
  if (!entry || entry.resetTime < now) {
    endpointStore.set(storeKey, { count: 1, resetTime: now + config.windowMs })
    return { allowed: true, resetTime: 0 }
  }

  // Increment count
  if (entry.count < config.maxRequests) {
    entry.count++
    return { allowed: true, resetTime: 0 }
  }

  // Rate limited
  return { allowed: false, resetTime: entry.resetTime }
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
 * System-wide rate limit middleware
 * Checks both global and endpoint-specific limits
 */
export async function rateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  if (process.env.RATE_LIMITING_ENABLED === "false") {
    return null
  }

  const pathname = request.nextUrl.pathname

  // Skip non-API routes
  if (!pathname.startsWith("/api/")) {
    return null
  }

  const ip = getClientIP(request)
  const globalConfig = getGlobalConfig()

  // Check GLOBAL rate limit first (per IP, across all endpoints)
  const globalCheck = checkGlobalRateLimit(ip, globalConfig)
  
  if (!globalCheck.allowed) {
    const retryAfterMs = globalCheck.resetTime - Date.now()
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))

    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `Too many requests from your device. Please try again in ${formatTime(retryAfterMs)}.`,
        details: {
          limit: `${globalConfig.maxRequests} requests per ${formatTime(globalConfig.windowMs)}`,
          retryAfter: retryAfterSeconds,
          type: "global",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
        },
      }
    )
  }

  // Check ENDPOINT-SPECIFIC rate limit (if configured)
  const endpointConfig = getEndpointConfig(pathname)
  if (endpointConfig) {
    const endpointCheck = checkEndpointRateLimit(ip, pathname, endpointConfig)
    
    if (!endpointCheck.allowed) {
      const retryAfterMs = endpointCheck.resetTime - Date.now()
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many requests to this endpoint. Please try again in ${formatTime(retryAfterMs)}.`,
          details: {
            limit: `${endpointConfig.maxRequests} requests per ${formatTime(endpointConfig.windowMs)}`,
            retryAfter: retryAfterSeconds,
            type: "endpoint",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      )
    }
  }

  return null
}

/**
 * Exported for compatibility
 */
export function isRateLimitingEnabled(): boolean {
  return process.env.RATE_LIMITING_ENABLED !== "false"
}
