import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !session.user.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workspaceId = session.user.workspaceId

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        workspaceId,
        status: { in: ["unread", "read"] },
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    const formatted = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      description: n.description,
      severity: n.severity,
      category: n.product?.category?.name || "Workspace",
      sku: n.product?.sku || "",
      stock: n.product?.stock || 0,
      minStock: n.product?.minStock || 0,
      createdAt: n.createdAt.toISOString(),
      alertId: n.alertId,
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error("Failed to fetch notifications:", error)
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    )
  }
}
