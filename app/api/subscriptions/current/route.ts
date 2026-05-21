import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Find every workspace this user belongs to
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    })
    const workspaceIds = memberships.map((m) => m.workspaceId)

    // Return the best active subscription the user holds across ALL their workspaces.
    // "Best" = highest plan price first, then most recently updated.
    const subscription = await prisma.subscription.findFirst({
      where: {
        workspaceId: { in: workspaceIds },
        status: { in: ["active", "trial"] },
      },
      include: { plan: true },
      orderBy: [{ plan: { monthlyPrice: "desc" } }, { updatedAt: "desc" }],
    })

    if (subscription) return NextResponse.json(subscription)

    // Fall back to the current workspace subscription (may be cancelled/expired)
    const fallback = await prisma.subscription.findUnique({
      where: { workspaceId: session.user.workspaceId },
      include: { plan: true },
    })
    return NextResponse.json(fallback ?? null)
  } catch (error) {
    console.error("Failed to fetch current subscription:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
