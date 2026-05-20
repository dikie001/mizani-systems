import NextAuth from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authConfig } from "./auth.config"
import { rateLimit } from "@/lib/rate-limit"

const { auth } = NextAuth(authConfig)

export default auth(async (request: NextRequest) => {
  // Only enforce proxy rate limits for API routes; page requests should render normally.
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const rateLimitResponse = await rateLimit(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"],
}
