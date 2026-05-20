import NextAuth from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { authConfig } from "./auth.config"
import { rateLimit } from "@/lib/rate-limit"

const { auth } = NextAuth(authConfig)

export default auth(async (request: NextRequest) => {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"],
}
