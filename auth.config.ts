import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

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
      
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
      const isSuperAdmin = !!(isLoggedIn && superAdminEmail && auth.user.email?.toLowerCase() === superAdminEmail.toLowerCase())

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
          // Super admin should only be allowed on super-admin routes or during auth flow
          if (!isSuperAdminRoute && !isAuthRoute) {
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
