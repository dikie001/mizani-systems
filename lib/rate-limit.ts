import { NextRequest, NextResponse } from "next/server"

type EndpointType = "auth" | "api" | "admin" | "payment" | "upload" | "search"

interface RateLimitEntry {
  count: number
  resetTime: number
  violations: number
}

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

const stores: Record<EndpointType | "global", Map<string, RateLimitEntry>> = {
  global: new Map(),
  auth: new Map(),
  api: new Map(),
  admin: new Map(),
  payment: new Map(),
  upload: new Map(),
  search: new Map(),
}

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

function isRateLimitingEnabled(): boolean {
  return process.env.RATE_LIMITING_ENABLED !== "false"
}

function getClientKey(request: NextRequest): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  const userId = request.headers.get("x-user-id")
  return userId ? `${ip}:${userId}` : ip
}

function getEndpointType(pathname: string): EndpointType {
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.includes("/auth/") ||
    pathname.includes("/signup") ||
    pathname.includes("/login") ||
    pathname.includes("/password")
  ) {
    return "auth"
  }

  if (
    pathname.startsWith("/api/super-admin/") ||
    pathname.startsWith("/super-admin/") ||
    pathname.includes("/admin/")
  ) {
    return "admin"
  }

  if (
    pathname.startsWith("/api/payments/") ||
    pathname.startsWith("/api/subscriptions/") ||
    pathname.startsWith("/payments/")
  ) {
    return "payment"
  }

  if (pathname.startsWith("/api/upload")) {
    return "upload"
  }

  if (pathname.includes("/search")) {
    return "search"
  }

  return "api"
}

function getGlobalConfig(): RateLimitConfig {
  return {
    windowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || "60000", 10),
    maxRequests: parseInt(
      process.env.RATE_LIMIT_GLOBAL_MAX_REQUESTS || "200",
      10
    ),
  }
}

function getConfig(type: EndpointType): RateLimitConfig {
  const configByType: Record<EndpointType, RateLimitConfig> = {
    auth: {
      windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || "900000", 10),
      maxRequests: parseInt(
        process.env.RATE_LIMIT_AUTH_MAX_REQUESTS || "5",
        10
      ),
    },
    api: {
      windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || "60000", 10),
      maxRequests: parseInt(
        process.env.RATE_LIMIT_API_MAX_REQUESTS || "120",
        10
      ),
    },
    admin: {
      windowMs: parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS || "60000", 10),
      maxRequests: parseInt(
        process.env.RATE_LIMIT_ADMIN_MAX_REQUESTS || "60",
        10
      ),
    },
    payment: {
      windowMs: parseInt(
        process.env.RATE_LIMIT_PAYMENT_WINDOW_MS || "300000",
        10
      ),
      maxRequests: parseInt(
        process.env.RATE_LIMIT_PAYMENT_MAX_REQUESTS || "5",
        10
      ),
    },
    upload: {
      windowMs: parseInt(
        process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || "60000",
        10
      ),
      maxRequests: parseInt(
        process.env.RATE_LIMIT_UPLOAD_MAX_REQUESTS || "10",
        10
      ),
    },
    search: {
      windowMs: parseInt(
        process.env.RATE_LIMIT_SEARCH_WINDOW_MS || "60000",
        10
      ),
      maxRequests: parseInt(
        process.env.RATE_LIMIT_SEARCH_MAX_REQUESTS || "60",
        10
      ),
    },
  }

  return configByType[type]
}

function formatTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`
  const hours = Math.ceil(minutes / 60)
  return `${hours} hour${hours !== 1 ? "s" : ""}`
}

function checkRateLimit(
  storeName: EndpointType | "global",
  key: string,
  config: RateLimitConfig
): { allowed: boolean; resetTime: number; violations: number } {
  const now = Date.now()
  const store = stores[storeName]
  const entry = store.get(key)

  if (!entry || entry.resetTime < now) {
    store.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      violations: 0,
    })
    return { allowed: true, resetTime: 0, violations: 0 }
  }

  if (entry.count < config.maxRequests) {
    entry.count++
    return { allowed: true, resetTime: 0, violations: entry.violations }
  }

  entry.violations += 1
  if (entry.violations >= 3) {
    const penaltyMinutes = Math.min(entry.violations * 5, 60)
    entry.resetTime = now + penaltyMinutes * 60000
  }

  return {
    allowed: false,
    resetTime: entry.resetTime,
    violations: entry.violations,
  }
}

export async function rateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  if (!isRateLimitingEnabled()) {
    return null
  }

  const pathname = request.nextUrl.pathname

  if (
    pathname.startsWith("/_next/") ||
    pathname.includes(".png") ||
    pathname.includes(".jpg") ||
    pathname.includes(".jpeg") ||
    pathname.includes(".svg") ||
    pathname.includes(".webp") ||
    pathname.includes(".css") ||
    pathname.includes(".js")
  ) {
    return null
  }

  const clientKey = getClientKey(request)

  const globalConfig = getGlobalConfig()
  const globalCheck = checkRateLimit("global", clientKey, globalConfig)

  if (!globalCheck.allowed) {
    const retryAfterMs = Math.max(0, globalCheck.resetTime - Date.now())
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))

    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `You have reached the global request limit. Please try again in ${formatTime(retryAfterMs)}.`,
        details: {
          limit: globalConfig.maxRequests,
          window: formatTime(globalConfig.windowMs),
          retryAfter: retryAfterSeconds,
          scope: "global",
          violations: globalCheck.violations,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
          "X-RateLimit-Limit": globalConfig.maxRequests.toString(),
          "X-RateLimit-Window": `${globalConfig.windowMs}ms`,
        },
      }
    )
  }

  if (!pathname.startsWith("/api/")) {
    return null
  }

  const endpointType = getEndpointType(pathname)
  const endpointConfig = getConfig(endpointType)
  const endpointCheck = checkRateLimit(endpointType, clientKey, endpointConfig)

  if (!endpointCheck.allowed) {
    const retryAfterMs = Math.max(0, endpointCheck.resetTime - Date.now())
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))

    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `Too many requests to this ${endpointType} area. Please try again in ${formatTime(retryAfterMs)}.`,
        details: {
          limit: endpointConfig.maxRequests,
          window: formatTime(endpointConfig.windowMs),
          retryAfter: retryAfterSeconds,
          scope: endpointType,
          violations: endpointCheck.violations,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
          "X-RateLimit-Limit": endpointConfig.maxRequests.toString(),
          "X-RateLimit-Window": `${endpointConfig.windowMs}ms`,
        },
      }
    )
  }

  return null
}
