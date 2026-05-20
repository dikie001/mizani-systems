import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

function normalizeEmail(email?: string | null) {
  return email?.replace(/"/g, "").trim().toLowerCase() ?? ""
}

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({}),
  ],
  trustHost: true,
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuthApiRoute = nextUrl.pathname.startsWith("/api/auth")
      if (isAuthApiRoute) {
        return true
      }

      const isLoggedIn = !!auth?.user
      const isDashboard = nextUrl.pathname.startsWith("/dashboard")
      const isOnboarding = nextUrl.pathname === "/onboarding"
      const isSuperAdminRoute = nextUrl.pathname.startsWith("/super-admin")
      const isAuthRoute = nextUrl.pathname.startsWith("/auth")
      // API routes must pass through so client-side fetches are not redirected to pages
      const isApiRoute = nextUrl.pathname.startsWith("/api/")

      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
      const isSuperAdmin = !!(
        isLoggedIn &&
        (normalizeEmail(auth.user.email) === normalizeEmail(superAdminEmail) ||
          (auth.user as any).role === "super_admin")
      )

      if (isSuperAdminRoute) {
        if (!isLoggedIn) {
          return false // Force redirect to /auth
        }
        if (!isSuperAdmin) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
      }

      if (isLoggedIn) {
        if (isSuperAdmin) {
          // Only redirect page navigations — never API calls (they return JSON, not HTML)
          if (!isSuperAdminRoute && !isAuthRoute && !isApiRoute) {
            return Response.redirect(new URL("/super-admin", nextUrl))
          }
        } else {
          // Regular logged-in users shouldn't see /auth or / (redirect to dashboard)
          if (nextUrl.pathname === "/auth" || nextUrl.pathname === "/") {
            return Response.redirect(new URL("/dashboard", nextUrl))
          }
        }
      } else {
        // Not logged in
        if (isOnboarding || isDashboard) {
          return false // Force redirect to /auth
        }
      }

      return true
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
}
