import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import { authConfig } from "./auth.config"

function normalizeEmail(email?: string | null) {
  return email?.replace(/"/g, "").trim().toLowerCase() ?? ""
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  events: {
    async signIn({ user, isNewUser }) {
      if (!user?.email) return

      try {
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
        const isSuperAdmin =
          normalizeEmail(user.email) === normalizeEmail(superAdminEmail)

        // 1. Increment loginCount and upgrade role if super admin
        await prisma.user.update({
          where: { email: user.email },
          data: {
            loginCount: { increment: 1 },
            ...(isSuperAdmin ? { role: "super_admin" } : {}),
          },
        })

        // 2. Create Audit Log for login
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, currentWorkspaceId: true },
        })

        if (dbUser) {
          await prisma.auditLog.create({
            data: {
              action: isNewUser
                ? "User Registered and Signed In"
                : "User Signed In via Google",
              entity: "Auth",
              type: "auth",
              userId: dbUser.id,
              workspaceId: dbUser.currentWorkspaceId || null,
            },
          })
        }
      } catch (err) {
        console.error("Error in signIn event:", err)
      }
    },
    async signOut(message) {
      // In Auth.js v5 events, signOut message is a union of token/session payloads.
      const userId = "session" in message ? message.session?.userId : undefined
      const email = "token" in message ? message.token?.email : undefined

      if (!userId && !email) return

      try {
        const dbUser = await prisma.user.findFirst({
          where: userId ? { id: userId } : { email: email ?? undefined },
          select: { id: true, currentWorkspaceId: true },
        })

        if (dbUser) {
          await prisma.auditLog.create({
            data: {
              action: "User Signed Out",
              entity: "Auth",
              type: "auth",
              userId: dbUser.id,
              workspaceId: dbUser.currentWorkspaceId || null,
            },
          })
        }
      } catch (err) {
        console.error("Error in signOut event:", err)
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) {
        return false
      }

      return true
    },
    async jwt({ token, user, trigger, session }) {
      // Refresh from DB:
      //  - on fresh sign-in (user?.email present)
      //  - on first token creation before workspaceId is populated
      //  - when role isn't yet promoted to super_admin but email matches
      const superAdminEmailRaw =
        process.env.SUPER_ADMIN_EMAIL || "omondidickens255@gmail.com"
      const superAdminEmailNorm = normalizeEmail(superAdminEmailRaw)
      const tokenEmailNorm = normalizeEmail(token.email as string | undefined)
      const emailMatchesSuperAdmin =
        superAdminEmailNorm && tokenEmailNorm === superAdminEmailNorm

      if (
        user?.email ||
        (token.sub && !token.workspaceId) ||
        (token.sub && emailMatchesSuperAdmin && token.role !== "super_admin")
      ) {
        const dbUser = await prisma.user.findUnique({
          where: token.sub
            ? { id: token.sub }
            : { email: (user?.email || token.email) as string },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            status: true,
            currentWorkspaceId: true,
            memberships: {
              select: {
                workspaceId: true,
                workspace: {
                  select: {
                    name: true,
                  },
                },
              },
              take: 1,
            },
          },
        })

        if (dbUser) {
          const superAdminEmail =
            process.env.SUPER_ADMIN_EMAIL || "omondidickens255@gmail.com"
          let role = dbUser.role

          if (
            normalizeEmail(dbUser.email) === normalizeEmail(superAdminEmail) &&
            dbUser.role !== "super_admin"
          ) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { role: "super_admin" },
            })
            role = "super_admin"
          }

          const currentMembership =
            dbUser.memberships.find(
              (m) => m.workspaceId === dbUser.currentWorkspaceId
            ) || dbUser.memberships[0]

          token.sub = dbUser.id
          token.email = dbUser.email
          token.name = dbUser.name
          token.picture = dbUser.image
          token.role = role
          token.status = dbUser.status
          token.workspaceId =
            dbUser.currentWorkspaceId || currentMembership?.workspaceId
          token.workspaceName = currentMembership?.workspace?.name
        }
      }

      if (trigger === "update" && session) {
        if (session.workspaceId) token.workspaceId = session.workspaceId
        if (session.workspaceName) token.workspaceName = session.workspaceName
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id
        session.user.role = typeof token.role === "string" ? token.role : "user"
        session.user.status =
          typeof token.status === "string" ? token.status : "active"
        session.user.workspaceId =
          typeof token.workspaceId === "string" ? token.workspaceId : undefined
        session.user.workspaceName =
          typeof token.workspaceName === "string"
            ? token.workspaceName
            : undefined
        session.user.name =
          typeof token.name === "string" ? token.name : session.user.name
        session.user.email =
          typeof token.email === "string" ? token.email : session.user.email
        session.user.image =
          typeof token.picture === "string" ? token.picture : session.user.image
      }

      return session
    },
  },
})
