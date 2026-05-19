import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { countAdminSeats, getPlanEntitlements, getWorkspacePlanName } from "@/lib/plans"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, role } = await req.json()

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId: session.user.workspaceId },
      include: { plan: true },
    })
    const planName = getWorkspacePlanName(subscription)
    const entitlements = getPlanEntitlements(planName)

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email }
    })

    // If user doesn't exist, create a placeholder user
    // In a real app, you'd send an email invite. 
    // Here we'll just link them so they see the workspace when they sign up.
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          status: "pending",
        }
      })
    }

    // Check if already a member
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: session.user.workspaceId,
          userId: user.id
        }
      }
    })

    if (existingMembership) {
      return NextResponse.json({ error: "User is already a member of this workspace" }, { status: 400 })
    }

    const normalizedRole = role === "ADMIN" ? "ADMIN" : "MEMBER"
    if (
      normalizedRole === "ADMIN" &&
      entitlements.maxAdminUsers !== null
    ) {
      const currentAdminSeats = countAdminSeats(
        await prisma.workspaceMember.findMany({
          where: { workspaceId: session.user.workspaceId },
          select: { role: true },
        })
      )

      if (currentAdminSeats >= entitlements.maxAdminUsers) {
        const planLabel = planName === "trial" ? "Free Trial" : "Basic"
        const upgradeLabel = planName === "trial" ? "Basic" : "Professional"

        return NextResponse.json(
          {
            error: `${planLabel} plans are limited to ${entitlements.maxAdminUsers} admin user${entitlements.maxAdminUsers === 1 ? "" : "s"}. Please upgrade to ${upgradeLabel} to invite another admin.`,
          },
          { status: 403 }
        )
      }
    }

    // Create membership
    await prisma.workspaceMember.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: user.id,
        role: normalizedRole,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to invite member:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
