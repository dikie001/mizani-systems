/**
 * Example: How to use rate limiting in your API routes
 * 
 * This file demonstrates various ways to implement rate limiting.
 * You can use the automatic middleware approach (recommended) or
 * add manual rate limiting to specific routes.
 */

import { NextRequest, NextResponse } from "next/server"
import { createRateLimitMiddleware, getRateLimitConfig } from "@/lib/rate-limit"

// =====================================================
// EXAMPLE 1: Automatic Rate Limiting (Recommended)
// =====================================================
// The middleware.ts file automatically handles rate limiting
// for all /api/* routes. Just write your handler normally:

export async function GET_example1(request: Request) {
  return NextResponse.json({
    message: "This route is automatically rate limited by middleware.ts"
  })
}

// =====================================================
// EXAMPLE 2: Manual Rate Limiting with Default Config
// =====================================================

export async function POST_example2(request: NextRequest) {
  // Get config for this specific endpoint
  const config = getRateLimitConfig("api/products")
  const rateLimiter = createRateLimitMiddleware(config)
  
  // Apply rate limiting
  const result = await rateLimiter(request, true) // true = use user ID if available
  
  if (!result.allowed) {
    return result.response
  }

  // Your handler code here
  return NextResponse.json({ success: true })
}

// =====================================================
// EXAMPLE 3: Manual Rate Limiting with Custom Config
// =====================================================

export async function POST_example3(request: NextRequest) {
  // Create rate limiter with custom settings
  const rateLimiter = createRateLimitMiddleware({
    windowMs: 60000,        // 1 minute window
    maxRequests: 5,         // 5 requests per minute
    keyPrefix: "strict-endpoint"
  })
  
  // Apply rate limiting
  const result = await rateLimiter(request, true)
  
  if (!result.allowed) {
    return result.response
  }

  // Your handler code here
  return NextResponse.json({ success: true })
}

// =====================================================
// EXAMPLE 4: Rate Limiting from Environment Variables
// =====================================================

export async function POST_example4(request: NextRequest) {
  // This reads custom environment variables if set
  // Example .env variables:
  // RATE_LIMIT_API_CUSTOM_ENDPOINT_WINDOW_MS=300000
  // RATE_LIMIT_API_CUSTOM_ENDPOINT_MAX_REQUESTS=20
  
  const config = getRateLimitConfig("api/custom-endpoint")
  const rateLimiter = createRateLimitMiddleware(config)
  
  const result = await rateLimiter(request, true)
  
  if (!result.allowed) {
    return result.response
  }

  // Your handler code here
  return NextResponse.json({ success: true })
}

// =====================================================
// EXAMPLE 5: Conditional Rate Limiting
// =====================================================

export async function POST_example5(request: NextRequest) {
  // Apply stricter limits for unauthenticated users
  const authHeader = request.headers.get("authorization")
  const isAuthenticated = !!authHeader
  
  const config = isAuthenticated
    ? { maxRequests: 1000, windowMs: 900000 }  // Generous for authenticated
    : { maxRequests: 50, windowMs: 900000 }    // Strict for anonymous
  
  const rateLimiter = createRateLimitMiddleware(config)
  const result = await rateLimiter(request, isAuthenticated)
  
  if (!result.allowed) {
    return result.response
  }

  // Your handler code here
  return NextResponse.json({ success: true })
}

// =====================================================
// EXAMPLE 6: Rate Limiting with Error Handling
// =====================================================

export async function POST_example6(request: NextRequest) {
  const config = getRateLimitConfig("api/sensitive")
  const rateLimiter = createRateLimitMiddleware(config)
  
  try {
    const result = await rateLimiter(request, true)
    
    if (!result.allowed) {
      // You can customize the error response
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again in 15 minutes.",
        },
        { status: 429 }
      )
    }
  } catch (error) {
    // If rate limiting fails, log and continue (don't block request)
    console.error("Rate limiting error:", error)
    // Optionally return error or let request through
  }

  // Your handler code here
  return NextResponse.json({ success: true })
}

// =====================================================
// NOTES
// =====================================================
// 1. The middleware.ts file automatically rate limits all /api/* routes
//    You don't need to add manual rate limiting unless you want custom behavior
//
// 2. Rate limit configuration is read from .env variables:
//    - RATE_LIMITING_ENABLED=true/false (global toggle)
//    - RATE_LIMIT_WINDOW_MS=milliseconds (default window)
//    - RATE_LIMIT_MAX_REQUESTS=number (default max)
//    - RATE_LIMIT_{ENDPOINT}_WINDOW_MS (endpoint-specific window)
//    - RATE_LIMIT_{ENDPOINT}_MAX_REQUESTS (endpoint-specific max)
//
// 3. User identification:
//    - Uses x-user-id header if available (from auth middleware)
//    - Falls back to IP address (x-forwarded-for or x-real-ip)
//    - Defaults to "unknown" if neither available
//
// 4. When rate limited, you receive:
//    - HTTP 429 (Too Many Requests)
//    - JSON error message
//    - Retry-After header with seconds to wait
//
// 5. See RATE_LIMITING.md for full documentation
