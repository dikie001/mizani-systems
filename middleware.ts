import { NextRequest, NextResponse } from "next/server";
import { createRateLimitMiddleware, isRateLimitingEnabled, getRateLimitConfig } from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  // Skip rate limiting for non-API routes
  const pathname = request.nextUrl.pathname;
  
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check if rate limiting is enabled
  if (!isRateLimitingEnabled()) {
    return NextResponse.next();
  }

  // Get rate limit config for the specific endpoint
  const config = getRateLimitConfig(pathname);
  
  // Create and apply rate limit middleware
  const rateLimitMiddleware = createRateLimitMiddleware(config);
  const result = await rateLimitMiddleware(request, true); // true = use user ID if available

  // Return rate limit error if exceeded
  if (!result.allowed) {
    return result.response!;
  }

  return NextResponse.next();
}

// Apply middleware only to API routes
export const config = {
  matcher: ["/api/:path*"],
};
