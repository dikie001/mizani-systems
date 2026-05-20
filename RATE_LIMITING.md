# Rate Limiting Implementation Guide

## Overview
Rate limiting is now configured and ready to use in your inventory system. All rate limits are configurable through environment variables in the `.env` file.

## How It Works

### Global Middleware
A middleware (`middleware.ts`) automatically applies rate limiting to all `/api/*` routes. This provides protection across your entire API without modifying individual route handlers.

### Configuration
All rate limiting is configured through environment variables in `.env`:

1. **Global Settings** (applies to all endpoints unless overridden):
   - `RATE_LIMITING_ENABLED` - Toggle rate limiting on/off (default: `true`)
   - `RATE_LIMIT_WINDOW_MS` - Time window in milliseconds (default: 900000 = 15 minutes)
   - `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

2. **Endpoint-Specific Settings**:
   - Format: `RATE_LIMIT_{ENDPOINT}_WINDOW_MS` and `RATE_LIMIT_{ENDPOINT}_MAX_REQUESTS`
   - Example: For `/api/auth/login`, use `RATE_LIMIT_AUTH_LOGIN_WINDOW_MS` and `RATE_LIMIT_AUTH_LOGIN_MAX_REQUESTS`
   - Replace `/` with `_` in endpoint names

## Rate Limit Configuration

### Default Values (15-minute window):
- **Auth endpoints** (login/signup): 5-3 requests
- **API endpoints** (products, orders, alerts, inventory): 100-50 requests
- **Upload endpoints**: 20 requests per hour
- **Payment endpoints**: 10 requests
- **Reports**: 30 requests per hour

## Usage in Routes

### Option 1: Automatic (Recommended)
The middleware automatically handles all rate limiting globally:

```typescript
// Your existing route - no changes needed!
export async function GET(request: Request) {
  // Your handler code
  return NextResponse.json({ /* data */ })
}
```

### Option 2: Manual per-route (Advanced)
For more granular control, you can apply rate limiting directly in a route:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createRateLimitMiddleware, getRateLimitConfig } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  // Apply rate limiting with custom config
  const config = getRateLimitConfig("api/custom-endpoint")
  const rateLimiter = createRateLimitMiddleware(config)
  
  const result = await rateLimiter(request, true) // true = use user ID if available
  
  if (!result.allowed) {
    return result.response
  }

  // Your handler code
  return NextResponse.json({ /* data */ })
}
```

## Customizing Rate Limits

### Adjust Time Window
Window times are in milliseconds:
- 1 minute = 60000
- 5 minutes = 300000
- 15 minutes = 900000 (default)
- 1 hour = 3600000

### Examples

#### Stricter Auth Protection
```env
RATE_LIMIT_AUTH_LOGIN_WINDOW_MS=600000
RATE_LIMIT_AUTH_LOGIN_MAX_REQUESTS=3
```

#### More Relaxed API Limits
```env
RATE_LIMIT_API_PRODUCTS_WINDOW_MS=900000
RATE_LIMIT_API_PRODUCTS_MAX_REQUESTS=200
```

#### Very Strict for Payments
```env
RATE_LIMIT_API_PAYMENTS_WINDOW_MS=3600000
RATE_LIMIT_API_PAYMENTS_MAX_REQUESTS=5
```

## HTTP Response

When a user exceeds the rate limit, they receive a 429 (Too Many Requests) response:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 900
}
```

The `Retry-After` header is also included with the number of seconds to wait.

## Identifying Users

The system uses IP addresses for rate limiting by default. If a user ID is available (from authentication), it will use that instead for more accurate per-user limiting.

### How user ID is detected:
1. Checks for `x-user-id` header (can be set by authentication middleware)
2. Falls back to IP address from `x-forwarded-for` or `x-real-ip` headers
3. Uses `unknown` if neither is available

## Implementation Details

- **In-Memory Storage**: Rate limits are stored in memory for fast access
- **Automatic Cleanup**: Old entries are cleaned up every minute
- **Sliding Window**: Uses a sliding window approach for accurate limiting
- **Production-Ready**: Works with serverless and traditional servers

## Performance Impact

- Minimal memory footprint (grows only with unique IPs/users)
- No database queries required
- Cleanup runs automatically in the background
- Typical memory usage: ~1-10MB for 1000-10000 active clients

## Disabling Rate Limiting

To temporarily disable rate limiting:
```env
RATE_LIMITING_ENABLED=false
```

## Testing

Test your rate limits:
```bash
# Install curl if needed
# Rapid requests to trigger limit
for i in {1..10}; do curl http://localhost:3000/api/alerts; done
```

You should see a 429 response after exceeding the limit.

## Future Enhancements

Potential improvements:
- Redis-backed rate limiting for distributed systems
- Async tracking with Upstash
- Custom rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining)
- Different limits for authenticated vs anonymous users
- IP whitelist/blacklist
