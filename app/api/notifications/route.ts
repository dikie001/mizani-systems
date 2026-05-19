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
    // 1. Fetch active alerts
    const alerts = await prisma.alert.findMany({
      where: {
        workspaceId,
        status: "active",
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    })

    // 2. Fetch recent audit logs (workspace activity)
    const logs = await prisma.auditLog.findMany({
      where: {
        workspaceId,
        type: { in: ["create", "update", "delete", "transfer"] },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    })

    // 3. Combine and format
    const alertItems = alerts.map((a) => ({
      id: a.id,
      type: "alert",
      title: a.product.name,
      description: `Stock level: ${a.product.stock} items left (minimum threshold is ${a.product.minStock}).`,
      severity: a.severity,
      category: a.product.category.name,
      sku: a.product.sku,
      stock: a.product.stock,
      minStock: a.product.minStock,
      createdAt: a.createdAt.toISOString(),
    }))

    const logItems = logs.map((l) => ({
      id: l.id,
      type: "activity",
      title: l.action,
      description: `${l.entity} action performed.`,
      severity: "info",
      category: l.entity,
      sku: "",
      stock: 0,
      minStock: 0,
      createdAt: l.createdAt.toISOString(),
    }))

    const unified = [...alertItems, ...logItems]

    // Sort by createdAt descending
    unified.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // Slice to the top 20 notifications
    return NextResponse.json(unified.slice(0, 20))
  } catch (error) {
    console.error("Failed to fetch notifications:", error)
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    )
  }
}
